function uploadImages(req, res) {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded' });
  }

  const base = `${req.protocol}://${req.get('host')}`;
  const urls = files.map((file) => `${base}/uploads/${file.filename}`);

  res.status(201).json({ urls });
}

module.exports = { uploadImages };
