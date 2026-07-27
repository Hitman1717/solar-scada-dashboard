import jwt from 'jsonwebtoken';

export function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Access Denied: No Authorization header provided' });
  }

  // Expect Bearer <token>
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ success: false, error: 'Access Denied: Invalid Authorization header format' });
  }

  const token = parts[1];

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'super-secure-scada-jwt-secret-key-123!');
    req.user = verified;
    next();
  } catch (err) {
    res.status(403).json({ success: false, error: 'Access Denied: Invalid or expired authentication token' });
  }
}
