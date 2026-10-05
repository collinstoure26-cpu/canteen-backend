require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const User = mongoose.model('User', new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  passwordHash: String,
  role: { type: String, enum: ['student', 'staff'], default: 'student' },
}));

const MenuItem = mongoose.model('MenuItem', new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
}));

const Order = mongoose.model('Order', new mongoose.Schema({
  student: String,
  items: [{ name: String, qty: Number, price: Number }],
  pickup: String,
  total: Number,
  status: { type: String, default: 'Placed' },
}, { timestamps: true }));

async function seed() {
  if ((await MenuItem.countDocuments()) === 0) {
    await MenuItem.insertMany([
      { name: 'Jollof Rice & Chicken', price: 3.5 },
      { name: 'Beef Burger', price: 2.8 },
      { name: 'Veggie Wrap', price: 2.2 },
      { name: 'Iced Tea', price: 1.0 },
    ]);
  }
  if (!(await User.findOne({ email: 'staff@campus.edu' }))) {
    await User.create({
      email: 'staff@campus.edu',
      passwordHash: await bcrypt.hash('1234', 10),
      role: 'staff',
    });
  }
}

app.get('/menu', async (req, res) => {
  res.json(await MenuItem.find());
});

app.post('/register', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  if (!email || password.length < 4)
    return res.status(400).json({ error: 'Email and a 4+ character password required' });
  if (await User.findOne({ email }))
    return res.status(409).json({ error: 'Email already registered' });
  await User.create({ email, passwordHash: await bcrypt.hash(password, 10), role: 'student' });
  res.json({ email, role: 'student' });
});

app.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.passwordHash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ email: user.email, role: user.role });
});

app.post('/orders', async (req, res) => {
  const order = await Order.create(req.body);
  res.json(order);
});

app.get('/orders', async (req, res) => {
  const filter = req.query.student ? { student: req.query.student } : {};
  res.json(await Order.find(filter).sort({ createdAt: -1 }));
});

app.patch('/orders/:id', async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id, { status: req.body.status }, { new: true });
  res.json(order);
});


app.post('/menu', async (req, res) => {
  const { name, price, image } = req.body;
  if (!name || price == null)
    return res.status(400).json({ error: 'Name and price required' });
  res.json(await MenuItem.create({ name, price, image }));
});

app.put('/menu/:id', async (req, res) => {
  const { name, price, image } = req.body;
  res.json(await MenuItem.findByIdAndUpdate(
    req.params.id, { name, price, image }, { new: true }));
});

app.delete('/menu/:id', async (req, res) => {
  await MenuItem.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
mongoose
  .connect(process.env.MONGODB_URI, { dbName: 'canteen' })
  .then(async () => {
    console.log('MongoDB connected');
    await seed();
    app.listen(PORT, () => console.log('API running on port ' + PORT));
  })
  .catch((e) => console.error('MongoDB error:', e.message));
