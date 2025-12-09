import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// Create server function for Smithery
export default function createServer({ config }: { config?: any } = {}) {
    // Create server instance
    const server = new McpServer({
        name: 'typescript-mcp-server-base',
        version: '1.0.0'
    })

    server.registerTool(
        'greet',
        {
            description: '이름과 언어를 입력하면 인사말을 반환합니다.',
            inputSchema: z.object({
                name: z.string().describe('인사할 사람의 이름'),
                language: z
                    .enum(['ko', 'en'])
                    .optional()
                    .default('en')
                    .describe('인사 언어 (기본값: en)')
            }),
            outputSchema: z.object({
                content: z
                    .array(
                        z.object({
                            type: z.literal('text'),
                            text: z.string().describe('인사말')
                        })
                    )
                    .describe('인사말')
            })
        },
        async ({ name, language }) => {
            const greeting =
                language === 'ko'
                    ? `안녕하세요, ${name}님!`
                    : `Hey there, ${name}! 👋 Nice to meet you!`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: greeting
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: greeting
                        }
                    ]
                }
            }
        }
    )

    server.registerTool(
        'geocode',
        {
            description:
                '주소나 장소 이름을 입력하면 위도와 경도를 반환합니다.',
            inputSchema: z.object({
                address: z
                    .string()
                    .describe(
                        '주소나 장소 이름 (예: "서울시 강남구", "New York City")'
                    )
            }),
            outputSchema: z.object({
                content: z
                    .array(
                        z.object({
                            type: z.literal('text'),
                            text: z.string().describe('지오코딩 결과')
                        })
                    )
                    .describe('지오코딩 결과')
            })
        },
        async ({ address }) => {
            try {
                // OpenStreetMap Nominatim API 사용 (무료, API 키 불필요)
                const encodedAddress = encodeURIComponent(address)
                const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`

                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'MCP-Geocode-Server/1.0.0'
                    }
                })

                if (!response.ok) {
                    throw new Error(`Geocoding API error: ${response.status}`)
                }

                const data = await response.json()

                if (!data || data.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: `주소 "${address}"에 대한 위치를 찾을 수 없습니다.`
                            }
                        ],
                        structuredContent: {
                            content: [
                                {
                                    type: 'text' as const,
                                    text: `주소 "${address}"에 대한 위치를 찾을 수 없습니다.`
                                }
                            ]
                        }
                    }
                }

                const result = data[0]
                const latitude = parseFloat(result.lat)
                const longitude = parseFloat(result.lon)
                const displayName = result.display_name

                const resultText = `주소: ${displayName}\n위도: ${latitude}\n경도: ${longitude}`

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ],
                    structuredContent: {
                        content: [
                            {
                                type: 'text' as const,
                                text: resultText
                            }
                        ]
                    }
                }
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : '알 수 없는 오류가 발생했습니다.'
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `지오코딩 중 오류가 발생했습니다: ${errorMessage}`
                        }
                    ],
                    structuredContent: {
                        content: [
                            {
                                type: 'text' as const,
                                text: `지오코딩 중 오류가 발생했습니다: ${errorMessage}`
                            }
                        ]
                    }
                }
            }
        }
    )

    server.registerTool(
        'get-weather',
        {
            description:
                '위도와 경도를 입력하면 해당 위치의 날씨 정보를 반환합니다.',
            inputSchema: z.object({
                latitude: z
                    .number()
                    .min(-90)
                    .max(90)
                    .describe('위도 (latitude)'),
                longitude: z
                    .number()
                    .min(-180)
                    .max(180)
                    .describe('경도 (longitude)')
            }),
            outputSchema: z.object({
                content: z
                    .array(
                        z.object({
                            type: z.literal('text'),
                            text: z.string().describe('날씨 정보')
                        })
                    )
                    .describe('날씨 정보')
            })
        },
        async ({ latitude, longitude }) => {
            try {
                // Open-Meteo API 사용 (무료, API 키 불필요)
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto`

                const response = await fetch(url)

                if (!response.ok) {
                    throw new Error(`Weather API error: ${response.status}`)
                }

                const data = await response.json()

                if (!data || !data.current) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: `위도 ${latitude}, 경도 ${longitude} 위치의 날씨 정보를 가져올 수 없습니다.`
                            }
                        ],
                        structuredContent: {
                            content: [
                                {
                                    type: 'text' as const,
                                    text: `위도 ${latitude}, 경도 ${longitude} 위치의 날씨 정보를 가져올 수 없습니다.`
                                }
                            ]
                        }
                    }
                }

                const current = data.current
                const temperature = current.temperature_2m
                const weatherCode = current.weather_code
                const humidity = current.relative_humidity_2m
                const windSpeed = current.wind_speed_10m

                // 날씨 코드를 한글로 변환
                const weatherDescriptions: Record<number, string> = {
                    0: '맑음',
                    1: '대체로 맑음',
                    2: '부분적으로 흐림',
                    3: '흐림',
                    45: '안개',
                    48: '침식 안개',
                    51: '약한 이슬비',
                    53: '보통 이슬비',
                    55: '강한 이슬비',
                    56: '약한 동결 이슬비',
                    57: '강한 동결 이슬비',
                    61: '약한 비',
                    63: '보통 비',
                    65: '강한 비',
                    66: '약한 동결 비',
                    67: '강한 동결 비',
                    71: '약한 눈',
                    73: '보통 눈',
                    75: '강한 눈',
                    77: '눈알갱이',
                    80: '약한 소나기',
                    81: '보통 소나기',
                    82: '강한 소나기',
                    85: '약한 눈 소나기',
                    86: '강한 눈 소나기',
                    95: '뇌우',
                    96: '우박과 함께하는 뇌우',
                    99: '강한 우박과 함께하는 뇌우'
                }

                const weatherDescription =
                    weatherDescriptions[weatherCode] || '알 수 없음'

                const resultText = `위치: 위도 ${latitude}, 경도 ${longitude}
날씨: ${weatherDescription}
온도: ${temperature}°C
습도: ${humidity}%
풍속: ${windSpeed} km/h`

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ],
                    structuredContent: {
                        content: [
                            {
                                type: 'text' as const,
                                text: resultText
                            }
                        ]
                    }
                }
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : '알 수 없는 오류가 발생했습니다.'
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `날씨 정보를 가져오는 중 오류가 발생했습니다: ${errorMessage}`
                        }
                    ],
                    structuredContent: {
                        content: [
                            {
                                type: 'text' as const,
                                text: `날씨 정보를 가져오는 중 오류가 발생했습니다: ${errorMessage}`
                            }
                        ]
                    }
                }
            }
        }
    )

    // Return server instance for Smithery
    return server
}

// Direct execution support for Docker/local runs
// Only run when executed directly via CLI (not when imported by Smithery)
const isDirectExecution =
    typeof require !== 'undefined' && require.main === module

if (isDirectExecution) {
    const server = createServer()
    server
        .connect(new StdioServerTransport())
        .catch(console.error)
        .then(() => {
            console.error('MCP server started')
        })
}
