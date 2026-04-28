# Photodump - 3D Photo Gallery

This site is designed to dynamically read your photo collections and display them in a high-performance infinite grid. 

## How to Add or Update Albums

To customize the gallery with your own photos, follow these three simple steps:

### 1. Create a Folder
Navigate to the `albums/` directory. Create a new folder for your album. The name of this folder will be displayed in the website's menu.
*Example: `albums/Japan`*

### 2. Add Your Photos
Place your images directly into the folder you just created. 
- Supported formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- **No limits:** You can add 5 photos or 500 photos. The app automatically detects how many photos are in the folder and scales the infinite grid mathematically to match!

### 3. Update the Menu
Open the `albums/albums.json` file in a text editor. Add your exact folder name to the list, surrounded by quotes and separated by commas. 
*Example:*
```json
[
  "Amsterdam",
  "Australia",
  "Japan"
]
```

That's it!
