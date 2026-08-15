export async function GET() {
  return Response.json({ status: 'healthy', service: 'velvetia-web', timestamp: new Date().toISOString() })
}

