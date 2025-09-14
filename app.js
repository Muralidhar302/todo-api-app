const express = require('express');
const helmet = require('helmet');
const winston = require('winston');
const client = require('prom-client');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// ---------------- Logging ----------------
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// ---------------- Prometheus Metrics ----------------
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.5, 1, 1.5],
});
register.registerMetric(httpRequestDuration);

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'code'],
});
register.registerMetric(httpRequestCounter);

// ---------------- Middleware for metrics ----------------
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = { method: req.method, route: req.path, code: res.statusCode };
    end(labels);
    httpRequestCounter.inc(labels);
  });
  next();
});

app.use(helmet());
app.use(bodyParser.json());

// ---------------- In-memory storage ----------------
let todos = [];
let idCounter = 1;

// ---------------- Routes ----------------

// Health check
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.status(200).send('OK');
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Get all todos
app.get('/todos', (req, res) => {
  logger.info('GET /todos');
  res.json(todos);
});

// Create todo
app.post('/todos', (req, res) => {
  const { task } = req.body;
  if (!task) return res.status(400).json({ error: 'Task required' });

  const todo = { id: idCounter++, task, completed: false };
  todos.push(todo);
  logger.info(`Added todo: ${todo.task}`);
  res.status(201).json(todo);
});

// Update todo
app.put('/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const todo = todos.find((t) => t.id === id);

  if (!todo) return res.status(404).json({ error: 'Todo not found' });

  const { task, completed } = req.body;
  if (task) todo.task = task;
  if (completed !== undefined) todo.completed = completed;

  logger.info(`Updated todo ${id}`);
  res.json(todo);
});

// Delete todo
app.delete('/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  todos = todos.filter((t) => t.id !== id);

  logger.info(`Deleted todo ${id}`);
  res.status(204).send();
});

// ---------------- Start server ----------------
app.listen(port, () => {
  logger.info(`Todo API running on port ${port}`);
});
