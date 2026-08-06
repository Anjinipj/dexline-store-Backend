const authService = require('../services/authService');
const generateToken = require('../utils/generateToken');
const userPresenter = require('../presenters/userPresenter');

async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    const token = generateToken(user);
    res.status(201).json({ token, user: userPresenter.toView(user) });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const user = await authService.login(req.body);
    const token = generateToken(user);
    res.json({ token, user: userPresenter.toView(user) });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    res.json({ user: userPresenter.toView(req.user) });
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const user = await authService.updateProfile(req.user.id, req.body);
    res.json({ user: userPresenter.toView(user) });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe, updateMe };
