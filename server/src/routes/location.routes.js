const express = require('express');
const router = express.Router();
const { getCountries, getStates } = require('../controllers/location.controller');

/**
 * Public location endpoints for focused research targeting
 */
router.get('/countries', getCountries);
router.get('/:code/states', getStates);

module.exports = router;
