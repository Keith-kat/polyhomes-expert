require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  createdAt: { type: Date, default: Date.now }
});
userSchema.methods.comparePassword = async function (password) {
  return password === this.password; // Replace with bcrypt later
};
const User = mongoose.model('User', userSchema);

const quoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  windowCount: Number,
  dimensions: String,
  material: String,
  totalCost: Number,
  createdAt: { type: Date, default: Date.now }
});
const Quote = mongoose.model('Quote', quoteSchema);

const reviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: Number,
  comment: String,
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Review = mongoose.model('Review', reviewSchema);
const cors = require('cors');
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:8080', 'http://127.0.0.1:5500', 'https://Keith-kat.github.io/polyhomes-expert'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const path = require('path');
const axios = require('axios');
const AfricasTalking = require('africastalking');

// =============================================
// INITIALIZATION
// =============================================
const app = express();
const ATClient = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME || 'sandbox' // Default to sandbox for testing
});

// =============================================
// MIDDLEWARE
// =============================================
app.use(helmet({ contentSecurityPolicy: false })); // Disable CSP for simplicity in dev
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:8080', 'https://Keith-kat.github.io/polyhomes-expert'], // Update with your frontend URL
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', limiter);

// =============================================
// DATABASE CONNECTION
// =============================================
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// =============================================
// MODELS
// =============================================
const User = require('./models/User');
const Inquiry = require('./models/Inquiry');
const Quote = require('./models/Quote');
const Installation = require('./models/Installation');
const Review = require('./models/Review');

// =============================================
// UTILITY FUNCTIONS
// =============================================
const getLocationFactor = (location) => {
  const normalized = location.toLowerCase();
  if (normalized.includes('nairobi') || normalized.includes('westlands') || normalized.includes('karen')) return 1.0;
  if (normalized.includes('thika') || normalized.includes('kiambu')) return 1.2;
  return 1.5;
};

const getInstallationTime = (location) => {
  const factor = getLocationFactor(location);
  if (factor === 1.0) return '3-5 working days';
  if (factor === 1.2) return '5-7 working days';
  return '7-10 working days';
};

const getCoverageMessage = (coverage) => {
  const messages = {
    premium: 'We provide premium same-week service in your area',
    standard: 'Standard service available with 3-5 day installation',
    limited: 'Service available with extended installation timeline'
  };
  return messages[coverage] || 'Service availability may vary';
};

// =============================================
// AUTHENTICATION MIDDLEWARE
// =============================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ success: false, message: 'Admin access required' });
};

// =============================================
// PRICING CONFIGURATION
// =============================================
const pricingMatrix = {
  materials: {
    fiberglass: 1500, // KES/m²
    polyester: 1800,
    stainless: 3500
  },
  types: {
    fixed: 1.0,
    sliding: 1.2,
    retractable: 1.5,
    pleated: 1.8,
    magnetic: 1.3,
    velcro: 1.1
  },
  locations: {
    nairobi: 1.0,
    westlands: 1.0,
    karen: 1.0,
    thika: 1.2,
    kiambu: 1.2,
    other: 1.5
  },
  warranties: {
    basic: 0,
    standard: 300,
    premium: 600
  }
};

// =============================================
// API ROUTES
// =============================================

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date(),
    version: '1.0.0'
  });
});

// Authentication Routes
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = new User({ name, email, password });
    await user.save();
    res.status(201).json({ success: true, message: 'User created' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating account' });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ success: true, token, name: user.name });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error logging in' });
  }
});

// Quote Routes
app.post('/api/quotes', async (req, res) => {
  try {
    const { windowCount, dimensions, material } = req.body;
    const totalCost = calculateCost(windowCount, dimensions, material); // Implement logic
    const quote = new Quote({ userId: req.body.userId, windowCount, dimensions, material, totalCost });
    await quote.save();
    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save quote' });
  }
});

    // Send SMS confirmation
    try {
      await ATClient.SMS.send({
        to: `+254${req.user.phone?.substring(req.user.phone.length - 9)}`,
        message: `PolyMesh Kenya: Your quote for ${windowCount} ${material} ${type} windows is KES ${Math.round(totalCost)}. Valid until ${quote.validUntil.toLocaleDateString()}.`
      });
    } catch (smsError) {
      console.warn('SMS sending failed:', smsError);
    }

    res.status(201).json({
      success: true,
      quote: {
        id: quote._id,
        totalCost: Math.round(totalCost),
        breakdown: {
          material: `${material} @ KES ${pricingMatrix.materials[material]}/m²`,
          type: `${type} (x${pricingMatrix.types[type]})`,
          location: `${location} (x${getLocationFactor(location).toFixed(1)})`,
          warranty: `${warranty} @ KES ${pricingMatrix.warranties[warranty]}/m²`
        },
        estimatedInstallation: getInstallationTime(location),
        nextSteps: [
          'We’ll call to confirm measurements',
          '50% deposit required via M-Pesa',
          `Installation in ${getInstallationTime(location)}`
        ]
      }
    });
  } catch (error) {
    console.error('Quote error:', error);
    res.status(500).json({ success: false, message: 'Error generating quote' });
  }
});

app.get('/api/user/quotes', authenticateToken, async (req, res) => {
  try {
    const quotes = await Quote.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .select('-__v -user');
    res.status(200).json({ success: true, count: quotes.length, quotes });
  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({ success: false, message: 'Error fetching quotes' });
  }
});

// Service Routes
app.post('/api/coverage', [
  body('address').notEmpty().trim()
], async (req, res) => {
  try {
    const { address } = req.body;
    const normalized = address.toLowerCase();
    const isNairobi = normalized.includes('nairobi') || normalized.includes('westlands') || normalized.includes('karen');
    const isOutskirts = ['thika', 'kiambu', 'ruaka', 'kikuyu', 'limuru'].some(loc => normalized.includes(loc));

    let coverage = 'standard';
    let installationDays = 3;

    if (isNairobi) {
      coverage = 'premium';
      installationDays = 2;
    } else if (isOutskirts) {
      coverage = 'standard';
      installationDays = 4;
    } else {
      coverage = 'limited';
      installationDays = 7;
    }

    res.status(200).json({
      success: true,
      coverage,
      installationDays,
      message: getCoverageMessage(coverage)
    });
  } catch (error) {
    console.error('Coverage check error:', error);
    res.status(500).json({ success: false, message: 'Error checking service coverage' });
  }
});

app.get('/api/service-areas', async (req, res) => {
  try {
    const serviceAreas = [
      { name: 'Nairobi Central', deliveryTime: '1-2 days', premium: true },
      { name: 'Westlands', deliveryTime: '1-2 days', premium: true },
      { name: 'Karen', deliveryTime: '1-2 days', premium: true },
      { name: 'Thika', deliveryTime: '3-4 days', premium: false },
      { name: 'Kiambu', deliveryTime: '3-4 days', premium: false },
      { name: 'Kikuyu', deliveryTime: '3-4 days', premium: false },
      { name: 'Other Areas', deliveryTime: '5-7 days', premium: false }
    ];

    res.status(200).json({ success: true, count: serviceAreas.length, serviceAreas });
  } catch (error) {
    console.error('Service areas error:', error);
    res.status(500).json({ success: false, message: 'Error fetching service areas' });
  }
});

// Inquiry Routes
app.post('/api/inquiries', [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('phone').notEmpty().trim(),
  body('inquiryType').isIn(['general', 'quote', 'technical', 'complaint']),
  body('message').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { name, email, phone, inquiryType, message } = req.body;
    const inquiry = new Inquiry({
      user: req.user?.id || null,
      name,
      email,
      phone,
      inquiryType,
      message,
      status: 'new'
    });

    await inquiry.save();

    // Send SMS confirmation
    try {
      await ATClient.SMS.send({
        to: `+254${phone.substring(phone.length - 9)}`,
        message: `PolyMesh Kenya: Thank you for your ${inquiryType} inquiry. We'll respond within 24 hours.`
      });
    } catch (smsError) {
      console.warn('SMS sending failed:', smsError);
    }

    res.status(201).json({ success: true, inquiry: { id: inquiry._id, status: inquiry.status } });
  } catch (error) {
    console.error('Inquiry submission error:', error);
    res.status(500).json({ success: false, message: 'Error submitting inquiry' });
  }
});

// Installation Routes
app.get('/api/installations/:id', authenticateToken, async (req, res) => {
  try {
    const installation = await Installation.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('quote', 'totalCost material type location');

    if (!installation) return res.status(404).json({ success: false, message: 'Installation not found' });

    res.status(200).json({ success: true, installation });
  } catch (error) {
    console.error('Installation tracking error:', error);
    res.status(500).json({ success: false, message: 'Error fetching installation details' });
  }
});

// Payment Routes
app.post('/api/mpesa-pay', [
  body('phone').notEmpty().matches(/^\+?254\d{9}$/).withMessage('Invalid Kenyan phone number'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least KES 1'),
  body('quoteId').isMongoId().withMessage('Invalid quote ID')
], authenticateToken, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { phone, amount, quoteId } = req.body;
    const quote = await Quote.findById(quoteId);
    if (!quote || quote.user.toString() !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }

    // Generate M-Pesa OAuth token
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
    const { data: { access_token } } = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` }
    });

    // Initiate STK Push
    app.post('/api/mpesa/stk-push', async (req, res) => {
  try {
    const { phoneNumber, amount } = req.body;
    const timestamp = getTimestamp();
    const password = getPassword(timestamp);
    const response = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: 'ExpertPolyHomes',
      TransactionDesc: 'Payment for mesh'
    }, {
      headers: { Authorization: `Bearer ${await getAccessToken()}` }
    });
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('M-Pesa error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate M-Pesa payment' });
  }
});
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
    const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');

    const response = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL || 'https://polyhomes-expert.onrender.com/api/mpesa-callback',
      AccountReference: `QUOTE-${quoteId}`,
      TransactionDesc: 'Mosquito Mesh Payment'
    }, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    await Quote.findByIdAndUpdate(quoteId, { paymentStatus: 'pending' });

    // Send SMS confirmation
    try {
      await ATClient.SMS.send({
        to: phone,
        message: `PolyMesh Kenya: Payment request of KES ${amount} for Quote #${quoteId} sent to ${phone}. Check your phone to complete via M-Pesa.`
      });
    } catch (smsError) {
      console.warn('SMS sending failed:', smsError);
    }

    res.status(200).json({ success: true, message: 'M-Pesa payment request sent', transactionId: response.data.CheckoutRequestID });
  } catch (error) {
    console.error('M-Pesa error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to initiate M-Pesa payment' });
  }
});

app.post('/api/mpesa-callback', async (req, res) => {
  try {
    const { Body: { stkCallback } } = req.body;
    const { CheckoutRequestID, ResultCode, CallbackMetadata } = stkCallback;

    if (ResultCode === 0) {
      const amount = CallbackMetadata.Item.find(item => item.Name === 'Amount')?.Value;
      const phone = CallbackMetadata.Item.find(item => item.Name === 'PhoneNumber')?.Value;
      const quoteId = CallbackMetadata.Item.find(item => item.Name === 'AccountReference')?.Value.split('-')[1];

      await Quote.findByIdAndUpdate(quoteId, {
        paymentStatus: 'completed',
        paymentDetails: { transactionId: CheckoutRequestID, amount, phone, date: new Date() }
      });

      // Send SMS confirmation
      try {
        await ATClient.SMS.send({
          to: phone,
          message: `PolyMesh Kenya: Payment of KES ${amount} for Quote #${quoteId} received. We'll contact you to schedule installation.`
        });
      } catch (smsError) {
        console.warn('SMS sending failed:', smsError);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.status(500).json({ success: false });
  }
});

// Review Routes
app.post('/api/reviews', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim()
], authenticateToken, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const review = new Review({
      user: req.user.id,
      rating: req.body.rating,
      comment: req.body.comment,
      approved: false
    });

    await review.save();
    res.status(201).json({ success: true, message: 'Review submitted, pending approval' });
  } catch (error) {
    console.error('Review submission error:', error);
    res.status(500).json({ success: false, message: 'Error submitting review' });
  }
});

app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ approved: true })
      .populate('user', 'name')
      .limit(10)
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, reviews });
  } catch (error) {
    console.error('Review fetch error:', error);
    res.status(500).json({ success: false, message: 'Error fetching reviews' });
  }
});

// Admin Routes
app.get('/api/admin/quotes', authenticateToken, isAdmin, async (req, res) => {
  try {
    const quotes = await Quote.find().populate('user', 'name email');
    res.status(200).json({ success: true, quotes });
  } catch (error) {
    console.error('Admin quotes error:', error);
    res.status(500).json({ success: false, message: 'Error fetching quotes' });
  }
});

app.get('/api/admin/reviews', authenticateToken, isAdmin, async (req, res) => {
  try {
    const reviews = await Review.find().populate('user', 'name');
    res.status(200).json({ success: true, reviews });
  } catch (error) {
    console.error('Admin reviews error:', error);
    res.status(500).json({ success: false, message: 'Error fetching reviews' });
  }
});

app.patch('/api/admin/reviews/:id', authenticateToken, isAdmin, [
  body('approved').isBoolean().withMessage('Approved must be a boolean')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { approved: req.body.approved },
      { new: true }
    );
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    res.status(200).json({ success: true, review });
  } catch (error) {
    console.error('Review approval error:', error);
    res.status(500).json({ success: false, message: 'Error updating review' });
  }
});

// SMS Routes
app.post('/api/send-sms', authenticateToken, isAdmin, async (req, res) => {
  const { phone, message } = req.body;
  try {
    await ATClient.SMS.send({
      to: `+254${phone.substring(phone.length - 9)}`,
      message: `PolyMesh Kenya: ${message}`
    });
    res.status(200).json({ success: true, message: 'SMS sent successfully' });
  } catch (error) {
    console.error('SMS error:', error);
    res.status(500).json({ success: false, message: 'Error sending SMS' });
  }
});

// Dashboard Route
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const [quotes, inquiries, installations] = await Promise.all([
      Quote.find({ user: req.user.id }).limit(5).sort({ createdAt: -1 }),
      Inquiry.find({ user: req.user.id }).limit(5).sort({ createdAt: -1 }),
      Installation.find({ user: req.user.id }).limit(5).sort({ scheduledDate: -1 })
    ]);

    res.status(200).json({
      success: true,
      dashboard: {
        quoteCount: quotes.length,
        latestQuotes: quotes,
        inquiryCount: inquiries.length,
        latestInquiries: inquiries,
        upcomingInstallations: installations
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Error loading dashboard data' });
  }
});

// Weather Data Route
app.get('/api/weather', async (req, res) => {
  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=Nairobi&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`);
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Weather error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch weather' });
  }
});

app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ approved: true });
    res.json({ success: true, reviews });
  } catch (error) {
    console.error('Reviews error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

// =============================================
// STATIC FILES & ERROR HANDLING
// =============================================
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Product Catalog
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().select('-__v');
    res.status(200).json({ success: true, products });
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

// Order Management
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { quoteId } = req.body;
    const quote = await Quote.findById(quoteId);
    if (!quote || quote.user.toString() !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }
    const order = new Order({ user: req.user.id, quote: quoteId });
    await order.save();
    await Quote.findByIdAndUpdate(quoteId, { status: 'accepted' });
    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ success: false, message: 'Error creating order' });
  }
});

// Email Notifications
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

app.post('/api/send-email', authenticateToken, async (req, res) => {
  const { to, subject, text } = req.body;
  try {
    await transporter.sendMail({
      from: '"PolyMesh Kenya" <polyhomesexpert@gmail.com>',
      to,
      subject,
      text
    });
    res.status(200).json({ success: true, message: 'Email sent' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ success: false, message: 'Error sending email' });
  }
});

// Geocoding for Coverage Check
app.post('/api/coverage', [
  body('address').notEmpty().trim()
], async (req, res) => {
  try {
    const { address } = req.body;
    const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
    const location = response.data[0];
    const isNairobi = location?.display_name.toLowerCase().includes('nairobi');
    // ... rest of the coverage logic
  } catch (error) {
    console.error('Coverage check error:', error);
    res.status(500).json({ success: false, message: 'Error checking coverage' });
  }
});

// =============================================
// SERVER START
// =============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});