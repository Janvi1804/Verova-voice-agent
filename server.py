import asyncio
import os
import io
import json
from aiohttp import web
import edge_tts

PORT = int(os.environ.get('PORT', 8000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

VOICES = {
    'swara': 'hi-IN-SwaraNeural',       # Hindi Female (Warm & Natural)
    'madhur': 'hi-IN-MadhurNeural',     # Hindi Male (Clear & Professional)
    'neerja': 'en-IN-NeerjaNeural',     # Indian English Female
    'prabhat': 'en-IN-PrabhatNeural'    # Indian English Male
}

async def handle_tts(request: web.Request) -> web.Response:
    """
    Endpoint: POST /api/tts or GET /api/tts
    Accepts text, voice, rate, pitch and streams high-fidelity MP3
    """
    if request.method == 'POST':
        try:
            data = await request.json()
        except Exception:
            data = {}
    else:
        data = dict(request.query)

    text = data.get('text', '').strip()
    voice_key = data.get('voice', 'hi-IN-SwaraNeural')
    rate = data.get('rate', '+0%')
    pitch = data.get('pitch', '+0Hz')

    voice = VOICES.get(voice_key.lower(), voice_key)
    if not voice.endswith('Neural'):
        voice = 'hi-IN-SwaraNeural'

    if not text:
        return web.json_response({'error': 'Text is required'}, status=400)

    if isinstance(rate, (int, float)):
        prefix = '+' if rate >= 0 else ''
        rate_str = f"{prefix}{int(rate)}%"
    elif isinstance(rate, str) and not rate.endswith('%'):
        rate_str = f"{rate}%"
    else:
        rate_str = rate or '+0%'

    if isinstance(pitch, (int, float)):
        prefix = '+' if pitch >= 0 else ''
        pitch_str = f"{prefix}{int(pitch)}Hz"
    elif isinstance(pitch, str) and not pitch.endswith('Hz'):
        pitch_str = f"{pitch}Hz"
    else:
        pitch_str = pitch or '+0Hz'

    try:
        communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate_str, pitch=pitch_str)
        mp3_buffer = io.BytesIO()

        async for chunk in communicate.stream():
            if chunk['type'] == 'audio':
                mp3_buffer.write(chunk['data'])

        mp3_bytes = mp3_buffer.getvalue()
        if not mp3_bytes:
            return web.json_response({'error': 'Failed to generate audio'}, status=500)

        return web.Response(
            body=mp3_bytes,
            content_type='audio/mpeg',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            }
        )
    except Exception as e:
        print(f'TTS Error: {e}')
        return web.json_response({'error': str(e)}, status=500)

async def handle_health(request: web.Request) -> web.Response:
    return web.json_response({
        'status': 'online',
        'service': 'Sarvam Hinglish Voice Agent Server',
        'engine': 'Microsoft Edge-TTS',
        'voices': VOICES
    }, headers={'Access-Control-Allow-Origin': '*'})

async def handle_options(request: web.Request) -> web.Response:
    return web.Response(
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    )

@web.middleware
async def cors_middleware(request, handler):
    if request.method == 'OPTIONS':
        return await handle_options(request)
    response = await handler(request)
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

def create_app():
    app = web.Application(middlewares=[cors_middleware])
    app.router.add_get('/api/health', handle_health)
    app.router.add_post('/api/tts', handle_tts)
    app.router.add_get('/api/tts', handle_tts)
    app.router.add_options('/api/tts', handle_options)
    app.router.add_static('/', path=BASE_DIR, show_index=True)
    return app

if __name__ == '__main__':
    import sys
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    app = create_app()
    print('=====================================================')
    print('Sarvam-Style Hinglish Voice Receptionist Server')
    print('Edge-TTS Engine: hi-IN-SwaraNeural / hi-IN-MadhurNeural')
    print(f'Running on: http://localhost:{PORT}')
    print('=====================================================')
    web.run_app(app, host='0.0.0.0', port=PORT)
