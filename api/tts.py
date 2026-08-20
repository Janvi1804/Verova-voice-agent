from http.server import BaseHTTPRequestHandler
import json
import asyncio
import io
import edge_tts
import urllib.parse

VOICES = {
    'swara': 'hi-IN-SwaraNeural',
    'madhur': 'hi-IN-MadhurNeural',
    'neerja': 'en-IN-NeerjaNeural',
    'prabhat': 'en-IN-PrabhatNeural'
}

async def generate_edge_tts(text, voice, rate_str, pitch_str):
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate_str, pitch=pitch_str)
    mp3_buffer = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk['type'] == 'audio':
            mp3_buffer.write(chunk['data'])
    return mp3_buffer.getvalue()

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        try:
            data = json.loads(body.decode('utf-8'))
        except Exception:
            data = {}
        self.process_tts(data)

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_path.query)
        data = {k: v[0] for k, v in query.items()}
        self.process_tts(data)

    def process_tts(self, data):
        text = data.get('text', '').strip()
        voice_key = data.get('voice', 'hi-IN-SwaraNeural')
        rate = data.get('rate', '+0%')
        pitch = data.get('pitch', '+0Hz')

        voice = VOICES.get(voice_key.lower(), voice_key)
        if not voice.endswith('Neural'):
            voice = 'hi-IN-SwaraNeural'

        if not text:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"error":"Text is required"}')
            return

        rate_str = str(rate) if str(rate).endswith('%') else f"{rate}%"
        pitch_str = str(pitch) if str(pitch).endswith('Hz') else f"{pitch}Hz"

        try:
            audio_bytes = asyncio.run(generate_edge_tts(text, voice, rate_str, pitch_str))
            self.send_response(200)
            self.send_header('Content-type', 'audio/mpeg')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=3600')
            self.end_headers()
            self.wfile.write(audio_bytes)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
