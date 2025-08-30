const jwt = require('jsonwebtoken');
const Users = require('../model/user');
const adminAuth = (req, res, next) => {
  const requestToken = 'xyzeee';
  let isAuthenticated = false;
  if (requestToken === 'xyz') isAuthenticated = true;
  if (isAuthenticated) {
    next();
  } else {
    res.status(401).send('User is not authorized');
  }
};

const userAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res
        .status(401)
        .json({ message: 'Token missing. Please login again!' });
    }
    const decodedObj = await jwt.verify(token, process.env.JWT_SECRET);
    const { _id } = decodedObj;
    if (!_id) {
      return res
        .status(401)
        .json({ message: 'Invalid token. Please login again!' });
    }
    const user = await Users.findById(_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('userAuth error:', error.message);
    res.status(400).json({ message: 'Authentication error: ' + error.message });
  }
};

module.exports = {
  adminAuth,
  userAuth
};
