import urllib.request
import os

urls = {
    "cctv-1.jpg": "https://loremflickr.com/400/300/traffic,camera/all",
    "cctv-2.jpg": "https://loremflickr.com/400/300/cctv,security/all",
    "cctv-3.jpg": "https://loremflickr.com/400/300/street,night,camera/all"
}

os.makedirs('trace-frontend/public/cctv', exist_ok=True)

for filename, url in urls.items():
    print(f"Downloading {filename}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            with open(f"trace-frontend/public/cctv/{filename}", 'wb') as out_file:
                out_file.write(response.read())
        print(f"Downloaded {filename}")
    except Exception as e:
        print(f"Failed {filename}: {e}")
