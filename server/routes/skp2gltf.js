const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// POST /api/convert/skp2gltf
router.post('/', upload.single('skp'), async (req, res) => {
  try {
    const skpFile = req.file;
    if (!skpFile) {
      return res.status(400).json({ error: 'No SKP file uploaded.' });
    }

    // Output path for glTF
    const outputDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    const outputFile = path.join(outputDir, `${path.parse(skpFile.filename).name}.gltf`);

    // Call SketchUp CLI or external converter (replace with actual command)
    // Example: skp2gltf-converter <input> <output>
    exec(`skp2gltf-converter "${skpFile.path}" "${outputFile}"`, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: stderr || error.message });
      }
      // Respond with the path to the converted glTF file
      res.json({ url: `/uploads/${path.basename(outputFile)}` });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
