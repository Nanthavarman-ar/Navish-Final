const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.glb', '.gltf', '.obj', '.stl', '.fbx', '.3ds', '.skp'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file format: ${fileExtension}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 10
  }
});

async function verifyUser(req) {
  const accessToken = req.headers.authorization?.split(' ')[1];
  if (!accessToken) {
    return { error: 'No authorization token provided', user: null };
  }
  return { error: null, user: { id: 'user123', role: 'client' } };
}

router.post('/model', upload.array('models', 10), async (req, res) => {
  try {
    const { error, user } = await verifyUser(req);
    if (error) {
      return res.status(401).json({ error });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      const fileInfo = {
        id: uuidv4(),
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        url: `/uploads/${file.filename}`,
        uploadedBy: user.id,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded'
      };

      const fileExtension = path.extname(file.originalname).toLowerCase();
      if (fileExtension === '.skp') {
        fileInfo.status = 'needs_conversion';
      }

      uploadedFiles.push(fileInfo);
    }

    res.json({
      message: 'Files uploaded successfully',
      files: uploadedFiles,
      count: uploadedFiles.length
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/models', async (req, res) => {
  try {
    const { error, user } = await verifyUser(req);
    if (error) {
      return res.status(401).json({ error });
    }

    const uploadsDir = path.join(__dirname, '../../public/uploads');
    
    try {
      const files = await fs.readdir(uploadsDir);
      const modelFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.glb', '.gltf', '.obj', '.stl', '.fbx', '.3ds'].includes(ext);
      });

      const models = await Promise.all(
        modelFiles.map(async (filename) => {
          const filePath = path.join(uploadsDir, filename);
          const stats = await fs.stat(filePath);
          
          return {
            id: filename,
            filename,
            url: `/uploads/${filename}`,
            size: stats.size,
            uploadedAt: stats.birthtime.toISOString()
          };
        })
      );

      res.json({ models });
    } catch (dirError) {
      res.json({ models: [] });
    }

  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ error: 'Failed to retrieve models' });
  }
});

router.delete('/models/:filename', async (req, res) => {
  try {
    const { error, user } = await verifyUser(req);
    if (error) {
      return res.status(401).json({ error });
    }

    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(__dirname, '../../public/uploads', filename);

    try {
      await fs.unlink(filePath);
      res.json({ message: 'Model deleted successfully' });
    } catch (unlinkError) {
      if (unlinkError.code === 'ENOENT') {
        return res.status(404).json({ error: 'Model not found' });
      }
      throw unlinkError;
    }

  } catch (error) {
    console.error('Delete model error:', error);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

module.exports = router;