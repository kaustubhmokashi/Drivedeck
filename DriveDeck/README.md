# DriveDeck

DriveDeck is a lightweight slideshow app that:

- accepts a Google Drive folder link
- shows the folder structure
- displays all images in a grid
- opens any image in a slideshow with keyboard navigation

## Run it

1. Create a Google Drive API key and enable the Google Drive API in Google Cloud.
2. Export the key before starting the app:

```bash
export GOOGLE_DRIVE_API_KEY=your_key_here
npm start
```

3. Open `http://localhost:3000`

## Notes

- The folder should be shared in a way the API key can access.
- Arrow keys move between slides.
- `Esc` closes the slideshow.
