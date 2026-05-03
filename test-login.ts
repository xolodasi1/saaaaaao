import * as http from 'http';
const req = http.request('http://localhost:3000/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(res.statusCode, data));
});
req.on('error', console.error);
// NOTE length of utf-8 buffer requires explicit handling if setting content-length, but let's just use stringification
// Wait, http.request needs Buffer length for Content-Length if provided, but we didn't provide Content-Length.
req.write(JSON.stringify({ nickname: 'фф' }));
req.end();
