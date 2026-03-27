# DriveDeck

DriveDeck is a lightweight slideshow app that:

- accepts a Google Drive folder link
- shows the folder structure
- displays all images in a grid
- opens any image in a slideshow with keyboard navigation
- can store phone-to-TV pairing codes in Firebase Firestore

## Run it

1. Create a Google Drive API key and enable the Google Drive API in Google Cloud.
2. Create a Firebase project and a Firestore database if you want cloud-backed pairing codes.
3. Create a Firebase service account for the server and base64-encode the JSON key.
4. Export the variables before starting the app:

```bash
export GOOGLE_DRIVE_API_KEY=your_key_here
export FIREBASE_SERVICE_ACCOUNT_BASE64=your_base64_service_account_json_here
npm start
```

5. Open `http://localhost:3000`

## Notes

- The folder should be shared in a way the API key can access.
- Pairing codes use Firestore when Firebase credentials are present. Otherwise they fall back to the local `data/remote-links.txt` file.
- Arrow keys move between slides.
- `Esc` closes the slideshow.
