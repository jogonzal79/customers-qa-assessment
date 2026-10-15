const defects = require('../defects.config');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;

createApp().listen(PORT, () => {
  console.log(`Customers mock app escuchando en http://localhost:${PORT}`);
  console.log(`  Frontend: http://localhost:${PORT}/`);
  console.log(`  Docs:     http://localhost:${PORT}/docs`);
  console.log('  Defectos activos:', Object.keys(defects).filter((k) => defects[k]).join(', ') || 'ninguno');
});
