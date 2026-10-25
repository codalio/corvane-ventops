const express = require('express');
const cors = require('cors');
const { authRequired, internalOnly } = require('./auth/middleware');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => res.json({ ok: true, site: process.env.SITE_NAME }));

app.use('/auth', require('./auth/routes'));

// called by the ingest worker, not by people
app.use('/internal', internalOnly, require('./routes/internal'));

app.use('/levels', authRequired, require('./routes/levels'));
app.use('/sensors', authRequired, require('./routes/sensors'));
app.use('/readings', authRequired, require('./routes/readings'));
app.use('/alarms', authRequired, require('./routes/alarms'));
app.use('/fans', authRequired, require('./routes/fans'));
app.use('/calibrations', authRequired, require('./routes/calibrations'));
app.use('/thresholds', authRequired, require('./routes/thresholds'));
app.use('/shift-log', authRequired, require('./routes/shiftLog'));
app.use('/reports', authRequired, require('./routes/reports'));
app.use('/users', authRequired, require('./routes/users'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`ventops api on ${port}`);
  require('./jobs').start();
});
