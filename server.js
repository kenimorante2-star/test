const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { Clerk } = require('@clerk/clerk-sdk-node');
const jwt = require('jsonwebtoken'); // For verifying Clerk tokens
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node'); // Clerk's SDK verification
require('dotenv').config(); // para ma load yung .env variables
const nodemailer = require('nodemailer');
const http = require('http'); //para sa realtime process
const { Server } = require('socket.io'); //para din sa realtime process
const { format, differenceInDays, addDays, differenceInHours, isAfter } = require('date-fns'); // Added differenceInHours and isAfter


const app = express();
const PORT = process.env.PORT || 3301;

// Honor X-Forwarded-* headers (needed on Railway) so req.protocol is accurate
// Honor X-Forwarded-* headers (needed on Railway) so req.protocol is accurate
app.set('trust proxy', 1);

// Flexible CORS: allow multiple origins via CORS_ORIGINS env (comma-separated)
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://sanjhislandhotel.up.railway.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsConfig = {
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsConfig));
app.options('*', cors(corsConfig));

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const idPictureStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads/id_pictures');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const userId = req.auth && req.auth.userId ? req.auth.userId : 'unknown';
        cb(null, `${userId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVICE_HOST,
    port: process.env.EMAIL_SERVICE_PORT,
    secure: process.env.EMAIL_SERVICE_PORT === '465', // Use 'true' for 465, 'false' for other ports like 587
    auth: {
        user: process.env.EMAIL_SERVICE_USER,
        pass: process.env.EMAIL_SERVICE_PASS
    },
    // Optional: for debugging email sending
    logger: true, // logs email send attempts to console
    debug: true // more detailed debug output
});

const uploadIdPicture = multer({
    storage: idPictureStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, JPG images, or PDF files are allowed for ID pictures!'));
        }
    }
});

const roomImageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads/room_images');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, `room-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const uploadRoomImages = multer({
storage: roomImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, or WEBP images are allowed for rooms.'));
    }
  },
});

//====================================================
// --- HTTP server and Socket.IO server ---
//==================================================

const server = http.createServer(app); // Create HTTP server using your express app
const io = new Server(server, { // Initialize Socket.IO with the HTTP server
    cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
});

//=======================================================================
//==========IO CONNECTION DITO=======
//=======================================================================

io.on('connection', (socket) => {
    console.log(`[Socket.IO] User connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`[Socket.IO] User disconnected: ${socket.id}`);
    });

    // Optional: You can add specific event listeners here if needed,
    // e.g., 'joinAdminRoom', 'joinUserRoom'
});

let roomDb;
let bookingDb;
let userDb;
let walkInBookingDb;
let feedbackDb;

async function initDbs() {
    try {
        roomDb = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.ROOM_DB,
            port: process.env.DB_PORT
        });
        console.log('Connected to Room Management Database (room_management_db)');

        bookingDb = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.BOOKING_DB,
            port: process.env.DB_PORT
        });
        console.log('Connected to Booking Database (booking_db)');

        userDb = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.USER_DB,
            port: process.env.DB_PORT
        });
        console.log('Connected to User Database (user_db)');

        feedbackDb = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.FEEDBACK_DB,
            port: process.env.DB_PORT
        });
        console.log('Connected to Feedback Database (feedback_db)');

         walkInBookingDb = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.WALKIN_DB,
            port: process.env.DB_PORT
        });
        console.log('Connected to Walk-In Booking Database (walk_in_booking_db)');


    } catch (err) {
        console.error('DB connection error:', err);
        process.exit(1);
    }
}

initDbs();

//=====================================================================
//REAL TIME PROCESSING DITO EMIT-REALTIME-UPDATE
//======================================================================

const emitRealtimeUpdate = (eventName, data) => {
    io.emit(eventName, data); // Emit to all connected clients
    console.log(`[Socket.IO] Emitted event "${eventName}" with data:`, data);
};

// Use process.env.CLERK_SECRET_KEY for security
// Make sure you have CLERK_SECRET_KEY=sk_test_89fXOZV3PCcCM9DobxUcWSxu9tXL0eLPjatJreeb2h in your .env file
const clerkClient = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

const verifyClerkToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('[verifyClerkToken] No authorization token provided.');
            return res.status(401).json({ error: 'Authorization token required' });
        }
        const token = authHeader.split(' ')[1];
        console.log('[verifyClerkToken] Attempting to verify token...');

        const session = await clerkClient.verifyToken(token);
        // console.log('[verifyClerkToken] Full session object after verification:', session); // Log this only during development

        req.auth = { userId: session.sub };

        console.log(`[verifyClerkToken] Token successfully verified for userId: ${req.auth.userId}`);
        next();

    } catch (error) {
        console.error('Clerk token verification error:', error.message);
        return res.status(401).json({ error: `Invalid or expired token: ${error.message}` });
    }
};

const safeParseJSON = (str, fallback) => {
    if (str === null || str === undefined || str === '') {
        return fallback;
    }

    if (typeof str === 'object' && str !== null) {
        if (Array.isArray(fallback) && !Array.isArray(str)) return fallback;
        if (typeof fallback === 'object' && !Array.isArray(fallback) && Array.isArray(str)) return fallback;
        return str;
    }

    try {
        const parsed = JSON.parse(str);
        if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
        if (typeof fallback === 'object' && !Array.isArray(fallback) && (typeof parsed !== 'object' || Array.isArray(parsed))) return fallback;
        return parsed;
    } catch (e) {
        // Fallback for comma-separated strings that look like paths or arrays
        if (typeof str === 'string' && str.includes('/uploads/') && str.includes(',')) {
            const result = str.split(',').map(s => s.trim());
            return result;
        }
        if (typeof str === 'string' && str.startsWith('[') && str.endsWith(']')) {
            const matches = str.match(/'([^']+)'|"[^"]+"|\b[^,\s\[\]]+\b/g);
            if (matches) {
                const result = matches.map(m => m.replace(/^['"]|['"]$/g, ''));
                return result;
            }
        }
        // Fallback for object-like strings that failed parsing
        if (typeof fallback === 'object' && fallback !== null && str.startsWith('{') && str.endsWith('}')) {
            try {
                const parsedObject = JSON.parse(str);
                return parsedObject;
            } catch (objError) {
                return fallback;
            }
        }

        return fallback;
    }
};

const getUserIdFromToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required.' });
        }
        const token = authHeader.split(' ')[1];

        const client = require('@clerk/clerk-sdk-node');
        const sessionClaims = await client.verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY, // Ensure this env var is set
        });
        req.auth = { userId: sessionClaims.sub }; // 'sub' is the user ID in Clerk JWTs
        next();
    } catch (err) {
        console.error('Token verification failed in getUserIdFromToken:', err);
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

// Middleware to check if the user is an admin
// You should uncomment and use this middleware for all /admin routes
const requireAdmin = async (req, res, next) => {
    if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    try {
        const user = await clerkClient.users.getUser(req.auth.userId);
        if (user.publicMetadata && user.publicMetadata.role === 'admin') {
            console.log(`Admin access granted for user: ${req.auth.userId}`);
            next();
        } else {
            console.warn(`Attempted admin access by non-admin user: ${req.auth.userId}`);
            return res.status(403).json({ error: 'Forbidden: Admin access required.' });
        }
    } catch (error) {
        console.error('Error checking admin role:', error);
        return res.status(500).json({ error: 'Failed to verify admin role.' });
    }
};

// ====================================================================
// =====================TESTIMONIALS ROUTES============================
// ====================================================================


// Middleware to ensure required database connection(s) are available before handling requests
// IMPORTANT: Only check the DBs relevant to the route so public endpoints don't fail when unrelated DBs are down
const isDbHealthy = (db) => {
    try {
        return !!db && !(db.connection && db.connection._closing);
    } catch (_) {
        return false;
    }
};

app.use((req, res, next) => {
    // Check if feedbackDb is initialized and not closing, and similarly for other dbs
    const path = req.path || '';

    // Routes that only need the feedback DB
    if (path.startsWith('/api/testimonials')) {
        if (!isDbHealthy(feedbackDb)) {
            console.error('[HealthCheck] Feedback DB not available.');
            return res.status(500).json({ message: 'Testimonials service unavailable. Please try again later.' });
        }
        return next();
    }

    // Routes that only need the room DB
    if (path === '/rooms' || path.startsWith('/rooms/') || path.startsWith('/room-ratings-summary')) {
        if (!isDbHealthy(roomDb)) {
            console.error('[HealthCheck] Room DB not available.');
            return res.status(500).json({ message: 'Rooms service unavailable. Please try again later.' });
        }
        return next();
    }

    // For all other routes, keep the strict check (these typically depend on multiple DBs)
    if (!isDbHealthy(feedbackDb) || !isDbHealthy(roomDb) || !isDbHealthy(bookingDb) || !isDbHealthy(userDb) || !isDbHealthy(walkInBookingDb)) {
        console.error('[HealthCheck] One or more required databases are not available.');
        return res.status(500).json({ message: 'Database connection error. Please try again later.' });
    }
    next();
});


// GET all testimonials
app.get('/api/testimonials', async (req, res) => {
    try {
        // Use the global feedbackDb connection
        const [rows] = await feedbackDb.query('SELECT id, name, address, review, rating, image_url, created_at FROM testimonials ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching testimonials:', err);
        res.status(500).json({ message: 'Error fetching testimonials', error: err.message });
    }
});

// POST a new testimonial
app.post('/api/testimonials', async (req, res) => {
    const { name, address, review, rating, image_url } = req.body;

    if (!name || !review || !rating) {
        return res.status(400).json({ message: 'Name, review, and rating are required.' });
    }

    try {
        // Using prepared statements to prevent SQL injection
        const [result] = await feedbackDb.execute(
            'INSERT INTO testimonials (name, address, review, rating, image_url) VALUES (?, ?, ?, ?, ?)',
            [name, address, review, rating, image_url]
        );
        res.status(201).json({ message: 'Testimonial added successfully!', id: result.insertId });
    } catch (err) {
        console.error('Error adding testimonial:', err);
        res.status(500).json({ message: 'Error adding testimonial', error: err.message });
    }
});


// ====================================================================
// USER PROFILE ROUTES
// ====================================================================

app.post('/api/user-profile', verifyClerkToken, uploadIdPicture.single('idPicture'), async (req, res) => {
    try {
        const { firstName, lastName, gender, birthDate, address, phoneNumber } = req.body;
        const idPictureUrl = req.file ? `/uploads/id_pictures/${req.file.filename}` : null;
        const authenticatedUserId = req.auth.userId;

        // Fetch user details from Clerk to get the email
        const clerkUser = await clerkClient.users.getUser(authenticatedUserId);
        const userEmail = clerkUser.emailAddresses[0].emailAddress;

        console.log('[API/user-profile] Received request to save profile.');
        console.log('[API/user-profile] Request Body (excluding file):', { firstName, lastName, gender, birthDate, address, phoneNumber });
        console.log('[API/user-profile] Uploaded File (if any):', req.file ? req.file.filename : 'None');
        console.log('[API/user-profile] Authenticated userId from Clerk Token:', authenticatedUserId);

        if (!authenticatedUserId) {
            console.error('[API/user-profile] Critical: No authenticated user ID found after token verification.');
            return res.status(403).json({ error: 'Authentication error: User ID missing.' });
        }
        // CORRECTED: Added phone_number to the required fields check
        if (!firstName || !lastName || !gender || !birthDate || !address || !phoneNumber) {
            console.error('[API/user-profile] Missing required profile fields:', { firstName, lastName, gender, birthDate, address, phoneNumber });
            return res.status(400).json({ error: 'All profile fields (First Name, Last Name, Gender, Birth Date, Address, Phone Number) are required.' });
        }

        const [rows] = await userDb.execute('SELECT * FROM users WHERE clerk_user_id = ?', [authenticatedUserId]);

        if (rows.length > 0) {
            // User exists, update the profile.
            // We'll build the update query dynamically to only update the id_picture_url if a new one is provided.
            let updateFields = ['first_name = ?', 'last_name = ?', 'gender = ?', 'birth_date = ?', 'address = ?', 'phone_number = ?', 'email = ?'];
            let updateParams = [firstName, lastName, gender, birthDate, address, phoneNumber, userEmail];

            if (idPictureUrl) {
                updateFields.push('id_picture_url = ?');
                updateParams.push(idPictureUrl);
            }
            updateParams.push(authenticatedUserId);
            const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE clerk_user_id = ?`;

            await userDb.execute(updateQuery, updateParams);
            res.status(200).json({ message: 'Profile updated successfully!' });
        } else {
            // New user, create the profile
            const insertQuery = 'INSERT INTO users (clerk_user_id, first_name, last_name, gender, birth_date, address, phone_number, email, id_picture_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
            const insertParams = [authenticatedUserId, firstName, lastName, gender, birthDate, address, phoneNumber, userEmail, idPictureUrl];
            await userDb.execute(insertQuery, insertParams);
            res.status(201).json({ message: 'Profile created successfully!' });
        }
    } catch (error) {
        console.error('*** [API/user-profile] UNCAUGHT BACKEND ERROR:', error);
        res.status(500).json({ error: 'Failed to save profile details.' });
    }
});

// GET user profile
app.get('/api/user-profile/:clerkUserId', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const { clerkUserId } = req.params;
        const authenticatedUserId = req.auth.userId;

        let isAdmin = false;
        try {
            // Check if the authenticated user is an admin
            // This requires the user to have an 'admin' role in their Clerk public metadata
            const adminUser = await clerkClient.users.getUser(authenticatedUserId);
            if (adminUser.publicMetadata && adminUser.publicMetadata.role === 'admin') {
                isAdmin = true;
                console.log(`[API/user-profile GET] Authenticated user ${authenticatedUserId} is an ADMIN.`);
            }
        } catch (clerkErr) {
            console.warn(`[API/user-profile GET] Could not fetch admin user details from Clerk for role check (user: ${authenticatedUserId}): ${clerkErr.message}`);
        }

        if (!isAdmin && authenticatedUserId !== clerkUserId) {
            console.error('[API/user-profile GET] Unauthorized: User ID mismatch. Cannot view other users profiles.');
            return res.status(403).json({ error: 'Unauthorized: You can only view your own profile.' });
        }

        // The `SELECT *` query already fetches all columns, including `phone_number`, so no change is needed here.
        const [rows] = await userDb.execute('SELECT * FROM users WHERE clerk_user_id = ?', [clerkUserId]);
        if (rows.length > 0) {
            console.log(`[API/user-profile GET] Profile found for ${clerkUserId}.`);
            res.status(200).json(rows[0]);
        } else {
            console.log(`[API/user-profile GET] Profile not found for ${clerkUserId}.`);
            res.status(404).json({ message: 'User profile not found.' });
        }
    } catch (error) {
        console.error('*** [API/user-profile GET] UNCAUGHT BACKEND ERROR:', error);
        res.status(500).json({ error: 'Failed to fetch user profile.' });
    }
});

// CORRECTED: New route for admin dashboard with phone numbers
app.get('/api/admin-dashboard', verifyClerkToken, async (req, res) => {
    try {
        const authenticatedUserId = req.auth.userId;
        const clerkClient = require('@clerk/clerk-sdk-node');
        const adminUser = await clerkClient.users.getUser(authenticatedUserId);

        // Check for admin role
        if (!adminUser.publicMetadata || adminUser.publicMetadata.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: You do not have admin access.' });
        }

        // Fetch all bookings (online) - still needed for the 'bookings' array in response
        const [onlineBookings] = await bookingDb.execute('SELECT * FROM bookings');

        // Fetch all walk-in bookings - still needed for the 'walkInBookings' array in response
        const [walkInBookings] = await walkInBookingDb.execute('SELECT * FROM bookings');

        // Fetch all physical rooms (from room_management_db)
        const [rooms] = await roomDb.execute('SELECT * FROM physical_rooms');

        // Fetch all users
        const [users] = await userDb.execute('SELECT * FROM users');

        // Calculate total revenue from online bookings
        // MODIFIED: Include bookings that are 'approved' and 'isPaid=1' OR have a 'checked_out' status.
        const [onlineRevenueRows] = await bookingDb.execute(
           "SELECT SUM(totalPrice) AS revenue FROM bookings WHERE (status = 'approved' AND isPaid = 1) OR status = 'checked_out'"
        );
        const onlineRevenue = onlineRevenueRows[0].revenue || 0;

        // Calculate total revenue from walk-in bookings
        // This query already correctly sums 'amountPaid' for non-rejected/non-cancelled bookings.
        const [walkInRevenueRows] = await walkInBookingDb.execute(
            `SELECT SUM(amountPaid) AS revenue FROM bookings WHERE status != 'rejected' AND status != 'cancelled'`
        );
        const walkInRevenue = walkInRevenueRows[0].revenue || 0;

        // Combine total revenue from both online and walk-in bookings
        const totalRevenue = parseFloat(onlineRevenue) + parseFloat(walkInRevenue);

        res.json({
            totalUsers: users.length,
            totalRooms: rooms.length,
            totalBookings: onlineBookings.length + walkInBookings.length, // Combined total
            totalRevenue: totalRevenue.toFixed(2),
            bookings: onlineBookings, // Keep for frontend display of online bookings
            walkInBookings: walkInBookings, // Keep for frontend display of walk-in bookings
            users,
            rooms
        });
    } catch (err) {
        console.error('Error fetching admin dashboard data:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch dashboard data' });
    }
});

// ====================================================================
// ROOM MANAGEMENT ROUTES
// ====================================================================
app.get('/room-ratings-summary', async (req, res) => {
    try {
        const [ratingsSummary] = await roomDb.execute(`
            SELECT
                roomId,
                AVG(rating) AS averageRating,
                COUNT(id) AS reviewCount
            FROM
                room_ratings
            GROUP BY
                roomId
        `);

        // Format the results into an object for easier lookup on the frontend
        const formattedSummary = {};
        ratingsSummary.forEach(row => {
            formattedSummary[row.roomId] = {
                averageRating: parseFloat(row.averageRating), // Ensure it's a number
                reviewCount: row.reviewCount
            };
        });

        res.json(formattedSummary);
    } catch (err) {
        console.error('Error fetching room ratings summary:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch room ratings summary' });
    }
});

// In server.js

app.get('/rooms/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch main room details
        const [rows] = await roomDb.query('SELECT * FROM rooms WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Room not found' });
        }

        const room = rows[0];

        // If images are stored as a JSON string, parse them
        if (room.images && typeof room.images === 'string') {
            try {
                room.images = JSON.parse(room.images);
            } catch (jsonError) {
                console.error("Error parsing room images JSON:", jsonError);
                room.images = []; // Default to empty array on error
            }
        } else if (!room.images) {
            room.images = [];
        }
// Normalize image URLs to absolute with correct base URL
        const baseUrl =
          process.env.BASE_URL || `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`;
        room.images = (Array.isArray(room.images) ? room.images : [])
          .map((img) => {
            if (!img) return null;
            if (typeof img !== 'string') return null;
            if (/^https?:\/\//i.test(img)) return img; // already absolute URL
            return `${baseUrl}${img.startsWith('/') ? img : `/uploads/room_images/${img}`}`;
          })
          .filter(Boolean);

        // Ensure amenities are parsed if stored as JSON string
        if (room.amenities && typeof room.amenities === 'string') {
            try {
                room.amenities = JSON.parse(room.amenities);
            } catch (jsonError) {
                console.error("Error parsing room amenities JSON:", jsonError);
                room.amenities = []; // Default to empty array on error
            }
        } else if (!room.amenities) {
            room.amenities = [];
        }

        // --- NEW ADDITIONS START HERE ---

        // Fetch average rating and review count for this room type
        // Assuming your room ratings are stored in a 'room_ratings' table
        // and that table has 'roomId' (referencing rooms.id), 'rating', and 'comment'
        const [ratingSummary] = await roomDb.query(`
            SELECT
                AVG(rating) AS averageRating,
                COUNT(id) AS reviewCount
            FROM
                room_ratings
            WHERE
                roomId = ?
        `, [id]);

        // Attach averageRating and reviewCount to the room object
        room.averageRating = ratingSummary[0].averageRating || 0; // Default to 0 if no reviews
        room.reviewCount = ratingSummary[0].reviewCount || 0;     // Default to 0 if no reviews

        // --- NEW ADDITIONS END HERE ---

        res.json(room); // Send the complete room object with rating data
    } catch (err) {
        console.error('Error fetching room by ID:', err);
        res.status(500).json({ error: 'Failed to fetch room details' });
    }
});
app.get('/rooms', async (req, res) => {
  try {
    const [results] = await roomDb.execute('SELECT * FROM rooms');
   const baseUrl =
      process.env.BASE_URL || `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`;

    const rooms = results.map(room => {
      const parsedImages = safeParseJSON(room.images, []);
      const parsedAmenities = safeParseJSON(room.amenities, []);
      const parsedOwner = safeParseJSON(room.owner, {});

      // ✅ Normalize image URLs correctly
      const fixedImages = parsedImages.map(img => {
        if (!img) return null;

        // If already a valid URL (starts with http:// or https://), just return it
        if (/^https?:\/\//i.test(img)) return img;

        // Otherwise, make it absolute with BASE_URL
        return `${baseUrl}${img.startsWith('/') ? img : `/uploads/room_images/${img}`}`;
      }).filter(Boolean); // Remove nulls

      return {
        ...room,
        amenities: parsedAmenities,
        images: fixedImages,
        owner: parsedOwner,
      };
    });

    res.json(rooms);
  } catch (err) {
    console.error('[SERVER] Error getting all rooms:', err);
    res.status(500).json({ error: err.message });
  }
});



app.post(
  '/rooms',
  verifyClerkToken,
  requireAdmin,
  uploadRoomImages.array('images', 5),
  async (req, res) => {
    const {
      roomType,
      pricePerNight,
      amenities,
      owner = JSON.stringify({}),
      isAvailable = true,
      maxGuests,
    } = req.body;
    const uploadedFiles = req.files;
    

    if (!roomType || pricePerNight === undefined || isNaN(Number(pricePerNight))) {
      return res
        .status(400)
        .json({ error: 'Missing or invalid required fields: roomType and pricePerNight' });
    }

    // --- Use full base URL for images ---
   const baseUrl =
      process.env.BASE_URL || `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`;

    let amenitiesArray;
    if (typeof amenities === 'string') {
      try {
        amenitiesArray = JSON.parse(amenities);
        if (!Array.isArray(amenitiesArray)) {
          console.warn('Parsed amenities was not an array, falling back to split:', amenities);
          amenitiesArray = amenities.split(',').map((a) => a.trim());
        }
      } catch (e) {
        console.warn('Failed to JSON parse amenities string, attempting split:', amenities);
        amenitiesArray = amenities.split(',').map((a) => a.trim());
      }
    } else if (Array.isArray(amenities)) {
      amenitiesArray = amenities;
    } else {
      amenitiesArray = [];
    }
    const amenitiesString = JSON.stringify(amenitiesArray);

    // --- FIXED: Use full image URLs ---
    const imageUrls =
      uploadedFiles && Array.isArray(uploadedFiles) && uploadedFiles.length > 0
        ? uploadedFiles.map((file) => `${baseUrl}/uploads/room_images/${file.filename}`)
        : [];

    const imagesString = JSON.stringify(imageUrls);

    let ownerParsed = {};
    try {
      ownerParsed = typeof owner === 'string' ? JSON.parse(owner) : owner;
    } catch (e) {
      console.warn('Could not parse owner string:', owner, e);
      ownerParsed = {};
    }
    const ownerString = JSON.stringify(ownerParsed);

    const isAvailableFlag =
      isAvailable === true || isAvailable === 'true' || isAvailable === 1 ? 1 : 0;

    const parsedMaxGuests =
      maxGuests === undefined || maxGuests === null || maxGuests === ''
        ? null
        : parseInt(maxGuests);
    if (parsedMaxGuests !== null && isNaN(parsedMaxGuests)) {
      return res.status(400).json({ error: 'Invalid maxGuests value' });
    }

    const query = `
      INSERT INTO rooms (roomType, pricePerNight, amenities, images, owner, isAvailable, maxGuests)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await roomDb.execute(query, [
        roomType,
        parseFloat(pricePerNight),
        amenitiesString,
        imagesString,
        ownerString,
        isAvailableFlag,
        parsedMaxGuests,
      ]);

      // Emit real-time update
      emitRealtimeUpdate('roomAdded', {
        id: result.insertId,
        roomType,
        pricePerNight: parseFloat(pricePerNight),
        amenities: amenitiesArray,
        images: imageUrls,
        owner: ownerParsed,
        isAvailable: isAvailableFlag,
        maxGuests: parsedMaxGuests,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      res
        .status(201)
        .json({ message: 'Room added', roomId: result.insertId, imageUrls: imageUrls });
    } catch (err) {
      console.error('Error adding room to database:', err);
      res.status(500).json({ error: err.message || 'Failed to add room' });
    }
  }
);


app.put('/rooms/:id', verifyClerkToken, requireAdmin, async (req, res) => {
    const roomId = req.params.id;
    let { roomType, pricePerNight, amenities, images = [], owner = {}, isAvailable, maxGuests } = req.body;

    if (!roomType || pricePerNight === undefined) {
        return res.status(400).json({ error: 'Missing required fields: roomType and pricePerNight are required' });
    }

    pricePerNight = parseFloat(pricePerNight);
    if (isNaN(pricePerNight)) {
        return res.status(400).json({ error: 'Invalid pricePerNight value' });
    }

    if (!Array.isArray(amenities)) {
        if (typeof amenities === 'string') {
            amenities = amenities.split(',').map(a => a.trim());
        } else {
            amenities = [];
        }
    }

    const isAvailableFlag = (isAvailable === true || isAvailable === 'true' || isAvailable === 1) ? 1 : 0;

    const parsedMaxGuests = (maxGuests === undefined || maxGuests === null || maxGuests === '') ? null : parseInt(maxGuests);
    if (parsedMaxGuests !== null && isNaN(parsedMaxGuests)) {
        return res.status(400).json({ error: 'Invalid maxGuests value' });
    }

    const amenitiesString = JSON.stringify(amenities);
    const imagesString = JSON.stringify(images);
    const ownerString = JSON.stringify(owner);

    const query = `
        UPDATE rooms
        SET roomType = ?, pricePerNight = ?, amenities = ?, images = ?, owner = ?, isAvailable = ?, maxGuests = ?
        WHERE id = ?
    `;

    try {
        const [result] = await roomDb.execute(query, [roomType, pricePerNight, amenitiesString, imagesString, ownerString, isAvailableFlag, parsedMaxGuests, roomId]); // Fixed maxGuests
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.json({ message: 'Room updated successfully' });

        // --- Emit real-time update after successful room update ---
        emitRealtimeUpdate('roomUpdated', {
            id: roomId,
            roomType: roomType,
            pricePerNight: pricePerNight,
            amenities: amenities,
            images: images,
            owner: owner,
            isAvailable: isAvailableFlag,
            maxGuests: parsedMaxGuests,
            updatedAt: new Date().toISOString(), // Assuming DB also updates this
        });


    } catch (err) {
        console.error(`Error updating room ${roomId}:`, err);
        res.status(500).json({ error: err.message || 'Failed to update room' });
    }
});

// Add this new API endpoint in server.js, typically near your other room-related endpoints
app.get('/rooms/:roomTypeId/reviews', async (req, res) => {
    try {
        const { roomTypeId } = req.params;

        // Fetch reviews for the given roomTypeId, joining with the users table
        // to get the reviewer's first and last name.
        // Assuming your 'room_ratings' table has 'userId', 'rating', and 'comment' columns,
        // and your 'users' table has 'id', 'firstName', and 'lastName' columns.
        const [reviews] = await roomDb.query(`
            SELECT
                rr.id,
                rr.userId,
                u.first_name,
                u.last_name,
                rr.rating,
                rr.comment,
                rr.created_at
            FROM
                room_ratings rr
            JOIN
                user_db.users u ON rr.userId = u.clerk_user_id
            WHERE
                rr.roomId = ?
            ORDER BY
                rr.created_at DESC
        `, [roomTypeId]);

        res.json(reviews); // Send the list of reviews as response
    } catch (err) {
        console.error("Error fetching room reviews:", err);
        res.status(500).json({ error: err.message || 'Failed to fetch room reviews' });
    }
});

app.patch('/rooms/:id', verifyClerkToken, requireAdmin, async (req, res) => {
    const roomId = req.params.id;
    const { isAvailable } = req.body;

    const isAvailableBoolean = (isAvailable === true || isAvailable === 'true');

    if (typeof isAvailable !== 'boolean' && typeof isAvailable !== 'string') {
        console.warn(`Invalid availability value received for room ${roomId}:`, isAvailable);
        return res.status(400).json({ message: 'Invalid availability value. Expected boolean or boolean string.' });
    }

    try {
        const [result] = await roomDb.execute('UPDATE rooms SET isAvailable = ? WHERE id = ?', [isAvailableBoolean ? 1 : 0, roomId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.status(200).json({ message: 'Availability updated' });

         // ---Emit real-time update after successful availability update ---
        emitRealtimeUpdate('roomAvailabilityUpdated', { id: roomId, isAvailable: isAvailableBoolean ? 1 : 0 });

    } catch (err) {
        console.error(`Error updating availability for room ${roomId}:`, err);
        res.status(500).json({ message: 'Server error during availability update.', error: err.message });
    }
});

// ====================================================================
// PHYSICAL ROOM ROUTES - NEW
// ====================================================================

// GET all physical rooms (admin only)
app.get('/physical-rooms', verifyClerkToken, requireAdmin, async (req, res) => {
    try {
        const [physicalRooms] = await roomDb.execute(`
            SELECT pr.*, r.roomType
            FROM physical_rooms pr
            JOIN rooms r ON pr.room_type_id = r.id
            ORDER BY pr.room_number
        `);
        res.json(physicalRooms);
    } catch (err) {
        console.error("Error fetching physical rooms:", err);
        res.status(500).json({ error: 'Failed to fetch physical rooms' });
    }
});

// GET available physical rooms for a specific room type (for booking approval)
app.get('/physical-rooms/available/:roomTypeId', verifyClerkToken, requireAdmin, async (req, res) => {
    const { roomTypeId } = req.params;
    // --- NEW CONSOLE LOGS ---
    console.log(`[SERVER] Received request for available physical rooms for roomTypeId: ${roomTypeId}`);
    // --- END NEW CONSOLE LOGS ---
    try {
        const [availablePhysicalRooms] = await roomDb.execute(
            `SELECT id, room_number FROM physical_rooms WHERE room_type_id = ? AND status = 'available'`,
            [roomTypeId]
        );
        // --- NEW CONSOLE LOGS ---
        console.log(`[SERVER] Query result for roomTypeId ${roomTypeId}:`, availablePhysicalRooms);
        // --- END NEW CONSOLE LOGS ---
        res.json(availablePhysicalRooms);
    } catch (err) {
        console.error(`Error fetching available physical rooms for room type ${roomTypeId}:`, err);
        res.status(500).json({ error: 'Failed to fetch available physical rooms' });
    }
});
app.get('/physical-rooms/check-existence/:roomTypeId', async (req, res) => {
    const { roomTypeId } = req.params;
    try {
        const [rows] = await roomDb.execute(
            `SELECT COUNT(*) AS count FROM physical_rooms WHERE room_type_id = ?`,
            [roomTypeId]
        );
        const hasPhysicalRooms = rows[0].count > 0;
        res.json({ hasPhysicalRooms: hasPhysicalRooms });
    } catch (err) {
        console.error(`Error checking physical room existence for room type ${roomTypeId}:`, err);
        res.status(500).json({ error: 'Failed to check physical room existence' });
    }
});

// POST a new physical room (admin only)
app.post('/physical-rooms', verifyClerkToken, requireAdmin, async (req, res) => {
    const { roomTypeId, roomNumber } = req.body;
    if (!roomTypeId || !roomNumber) {
        return res.status(400).json({ error: 'Room Type ID and Room Number are required.' });
    }
    try {
        // Check if room type exists
        const [roomTypeCheck] = await roomDb.execute('SELECT id FROM rooms WHERE id = ?', [roomTypeId]);
        if (roomTypeCheck.length === 0) {
            return res.status(404).json({ error: 'Room Type not found.' });
        }

        // Check if room number already exists
        const [existingRoom] = await roomDb.execute('SELECT id FROM physical_rooms WHERE room_number = ?', [roomNumber]);
        if (existingRoom.length > 0) {
            return res.status(409).json({ error: 'Physical room with this number already exists.' });
        }

        const [result] = await roomDb.execute(
            `INSERT INTO physical_rooms (room_type_id, room_number, status) VALUES (?, ?, 'available')`,
            [roomTypeId, roomNumber]
        );
        res.status(201).json({ message: 'Physical room added successfully', id: result.insertId });

        // Emit real-time update
        emitRealtimeUpdate('physicalRoomAdded', {
            id: result.insertId,
            room_type_id: roomTypeId,
            room_number: roomNumber,
            status: 'available',
            createdAt: new Date().toISOString()
        });

    } catch (err) {
        console.error("Error adding physical room:", err);
        res.status(500).json({ error: err.message || 'Failed to add physical room' });
    }
});

// PATCH physical room status (e.g., for check-in/check-out)
app.patch('/physical-rooms/:id/status', verifyClerkToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'available', 'occupied', 'maintenance'

    if (!status || !['available', 'occupied', 'maintenance'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided. Must be "available", "occupied", or "maintenance".' });
    }

    try {
        const [result] = await roomDb.execute(
            `UPDATE physical_rooms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Physical room not found.' });
        }
        res.json({ message: `Physical room ${id} status updated to ${status}.` });

        // Emit real-time update
        emitRealtimeUpdate('physicalRoomStatusUpdated', { id: id, status: status, updatedAt: new Date().toISOString() });

    } catch (err) {
        console.error(`Error updating physical room ${id} status:`, err);
        res.status(500).json({ error: err.message || 'Failed to update physical room status' });
    }
});

// DELETE a physical room (admin only)
app.delete('/physical-rooms/:id', verifyClerkToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await roomDb.execute('DELETE FROM physical_rooms WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Physical room not found.' });
        }
        res.json({ message: 'Physical room deleted successfully.' });

        // Emit real-time update
        emitRealtimeUpdate('physicalRoomDeleted', { id: id });

    } catch (err) {
        console.error(`Error deleting physical room ${id}:`, err);
        res.status(500).json({ error: err.message || 'Failed to delete physical room' });
    }
});

// GET endpoint to fetch the count of physical rooms for a given roomTypeId
app.get('/physical-rooms/count/:roomTypeId', async (req, res) => {
    try {
        const { roomTypeId } = req.params;
        const [rows] = await roomDb.query(
            `SELECT COUNT(*) AS count FROM room_management_db.physical_rooms WHERE room_type_id = ?`,
            [roomTypeId]
        );
        res.json({ count: rows[0].count });
    } catch (error) {
        console.error("Error fetching physical room count:", error);
        res.status(500).json({ error: "Failed to fetch physical room count" });
    }
});

// Ensure your existing server.js code remains above/below this new endpoint.

// ====================================================================
// =========      WALK IN BOOKING MANAGEMENT ROUTES        ===================
// ====================================================================

 // New route for fetching walk-in bookings
app.get('/bookings/walk-in', verifyClerkToken, async (req, res) => {
    try {
        // Corrected query: using 'bookingType' (assuming this is the correct column name in your DB)
        const [rows] = await bookingDb.query("SELECT * FROM bookings WHERE bookingType = 'walk-in' ORDER BY checkInDate DESC");
        res.json(rows);
    } catch (err) {
        console.error('Error fetching walk-in bookings:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch walk-in bookings' });
    }
});

app.get('/bookings/:id', verifyClerkToken, async (req, res) => {
        try {
            const [rows] = await bookingDb.execute('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Booking not found' });
            }
            res.json(rows[0]);
        } catch (err) {
            console.error('Error fetching booking:', err);
            res.status(500).json({ error: 'Failed to fetch booking' });
        }
    });


// GET bookings for a specific physical room (needed for availability check)
app.get('/bookings/physical-room/:physicalRoomId', verifyClerkToken, async (req, res) => {
    const { physicalRoomId } = req.params;
    try {
        // Assume 'physical_room_id' is the actual column name in your DB
        const [rows] = await bookingDb.query('SELECT * FROM bookings WHERE physical_room_id = ? ORDER BY checkInDate ASC', [physicalRoomId]);
        res.json(rows);
    } catch (err) {
        console.error(`Error fetching bookings for physical room ${physicalRoomId}:`, err);
        res.status(500).json({ error: err.message || 'Failed to fetch room bookings' });
    }
});


// Modified POST /bookings/walk-in to include new fields and remove bookingType
app.post('/bookings/walk-in', verifyClerkToken, requireAdmin, uploadIdPicture.single('validId'), async (req, res) => {
    try {
        const {
            firstName, lastName, email, phone, roomTypeId, physicalRoomId,
            checkInDate, checkOutDate, guests, earlyCheckInFee,
            actualCheckInTime,
            amountPaid, // Existing field
            discountType, // <--- Add discountType here
            totalPrice: frontendCalculatedTotalPrice, // <--- NEW: Get totalPrice from frontend (post-discount)
            discountAmount // <--- NEW: Get discountAmount from frontend
        } = req.body;

        console.log("Backend received data (POST /bookings/walk-in):", req.body);
        console.log("Backend received file:", req.file);

        if (!firstName || !lastName || !email || !phone || !roomTypeId || !physicalRoomId || !checkInDate || !checkOutDate || !guests || amountPaid === undefined || amountPaid === null || frontendCalculatedTotalPrice === undefined || frontendCalculatedTotalPrice === null || discountAmount === undefined || discountAmount === null) {
            return res.status(400).json({ error: 'Missing required booking fields.' });
        }

        const idPictureUrl = req.file ? `/uploads/id_pictures/${req.file.filename}` : null;

        // Fetch room details (still needed for calculatedRoomPrice and validation)
        const [roomTypeRows] = await roomDb.execute('SELECT pricePerNight, roomType, maxGuests FROM rooms WHERE id = ?', [roomTypeId]);
        if (roomTypeRows.length === 0) {
            return res.status(404).json({ error: 'Room type not found.' });
        }
        const roomType = roomTypeRows[0];

        const checkInDateObj = new Date(checkInDate);
        const checkOutDateObj = new Date(checkOutDate);

        const numberOfNights = differenceInDays(checkOutDateObj, checkInDateObj);
        if (numberOfNights <= 0) {
            return res.status(400).json({ error: 'Check-out date must be after check-in date.' });
        }

        const calculatedRoomPrice = roomType.pricePerNight;
        const finalEarlyCheckInFee = parseFloat(earlyCheckInFee || 0);

        // FIX: Use the totalPrice sent from the frontend, which already accounts for the discount.
        const totalCalculatedPrice = parseFloat(frontendCalculatedTotalPrice);

        // Determine isPaid status based on amountPaid and totalPrice
        let isPaidStatusInteger; // Use a new variable name for clarity
        let paymentStatusText; // Keep the string status for internal logic/other columns if needed

        if (updatedAmountPaid >= totalPrice) {
            isPaidStatusInteger = 1; // Correct: Use integer 1 for Fully Paid (True)
            paymentStatusText = 'Fully Paid'; 
        } else {
            isPaidStatusInteger = 0; // Correct: Use integer 0 for Partial/Not Paid (False)
            paymentStatusText = updatedAmountPaid > 0 ? 'Partial' : 'Not Paid';
        }
        // Set initial booking status for walk-in to 'Checked-In'
        const initialStatus = 'Checked-In';

        let checkInDateAndTime;
        if (actualCheckInTime) {
            checkInDateAndTime = actualCheckInTime.replace('T', ' ');
        } else {
            checkInDateAndTime = format(checkInDateObj, 'yyyy-MM-dd 14:00:00');
        }

        const checkOutDateAndTime = format(checkOutDateObj, 'yyyy-MM-dd 12:00:00');

        console.log("Final checkInDateAndTime for DB:", checkInDateAndTime);
        console.log("Final checkOutDateAndTime for DB:", checkOutDateAndTime);


        const [result] = await walkInBookingDb.execute(
            `INSERT INTO bookings (
                firstName, lastName, email, phone, roomTypeId, physicalRoomId,
                checkInDateAndTime, guests, nights, earlyCheckInFee, roomPrice, totalPrice,
                idPictureUrl, isPaid, amountPaid, status, checkOutDateAndTime, discount_type, discount_amount) -- <--- NEW: Add discountAmount here
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, // <--- NEW: Add a placeholder for discountAmount
            [
                firstName, lastName, email, phone, roomTypeId, physicalRoomId,
                checkInDateAndTime, guests, numberOfNights, finalEarlyCheckInFee, calculatedRoomPrice, totalCalculatedPrice,
                idPictureUrl, isPaidStatus, parseFloat(amountPaid), initialStatus, checkOutDateAndTime,
                discountType || 'none', // Pass discountType, default to 'none'
                parseFloat(discountAmount || 0) // <--- NEW: Pass discountAmount, default to 0
            ]
        );

        await roomDb.execute(
            `UPDATE physical_rooms SET status = 'occupied', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [physicalRoomId]
        );
        emitRealtimeUpdate('physicalRoomStatusUpdated', { id: physicalRoomId, status: 'occupied', updatedAt: new Date().toISOString() });


        const newBooking = {
            id: result.insertId,
            firstName, lastName, email, phone, roomTypeId, physicalRoomId,
            checkInDate: checkInDateAndTime,
            checkOutDate: checkOutDateAndTime,
            totalPrice: totalCalculatedPrice,
            earlyCheckInFee: earlyCheckInFee || 0,
            guests,
            actualCheckInTime,
            status: 'confirmed',
            roomPrice: calculatedRoomPrice,
            nights: numberOfNights,
            idPictureUrl: idPictureUrl,
            isPaid: isPaidStatus,
            discountType: discountType || 'none',
            discountAmount: parseFloat(discountAmount || 0), // <--- NEW: Include in the response
            createdAt: new Date().toISOString()
        };

        emitRealtimeUpdate('newWalkInBooking', newBooking);

        res.status(201).json({
            message: 'Walk-in booking created successfully',
            bookingId: result.insertId,
            totalPrice: totalCalculatedPrice,
            earlyCheckInFee: finalEarlyCheckInFee,
            isPaid: isPaidStatus,
            status: initialStatus,
            discountType: discountType || 'none',
            discountAmount: parseFloat(discountAmount || 0) // <--- NEW: Include in the response
        });

    } catch (err) {
        console.error('Error creating walk-in booking:', err);
        res.status(500).json({ error: err.message || 'Failed to create walk-in booking' });
    }
});

// --- server.js additions ---

// Add these PATCH routes to your server.js, typically after your other booking-related routes
// For example, you can place them after the /admin/bookings/:id/reject and /admin/bookings/:id/approve routes.

// PATCH route to mark a booking as paid
app.patch('/admin/bookings/walk-in/:id/record-payment', verifyClerkToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { amountPaid: newPaymentAmount } = req.body; // Renamed to avoid confusion with DB column

    if (newPaymentAmount === undefined || newPaymentAmount === null || isNaN(parseFloat(newPaymentAmount)) || parseFloat(newPaymentAmount) <= 0) {
        return res.status(400).json({ error: 'A valid payment amount is required.' });
    }

    try {
        // 1. Fetch the current booking details
        const [existingBookings] = await walkInBookingDb.execute('SELECT totalPrice, amountPaid FROM bookings WHERE id = ?', [id]);

        if (existingBookings.length === 0) {
            return res.status(404).json({ error: 'Booking not found.' });
        }

        const existingBooking = existingBookings[0];
        const currentAmountPaid = parseFloat(existingBooking.amountPaid || 0);
        const totalPrice = parseFloat(existingBooking.totalPrice);
        const amountToRecord = parseFloat(newPaymentAmount);

        // Calculate the new total amount paid for this booking
        const updatedAmountPaid = currentAmountPaid + amountToRecord;

        // Determine new 'isPaid' status
        let isPaidStatus;
        if (updatedAmountPaid >= totalPrice) {
            isPaidStatus = 'Fully Paid';
        } else if (updatedAmountPaid > 0 && updatedAmountPaid < totalPrice) {
            isPaidStatus = 'Partial';
        } else {
            isPaidStatus = 'Not Paid'; // Should ideally not happen if amountToRecord > 0
        }

        // 2. Update the booking in the database
        const [result] = await walkInBookingDb.execute(
            `UPDATE bookings SET amountPaid = ?, isPaid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [updatedAmountPaid, isPaidStatus, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Booking not found or no changes made.' });
        }

        res.json({
            message: 'Payment recorded successfully!',
            updatedBooking: {
                id: id,
                amountPaid: updatedAmountPaid,
                isPaid: isPaidStatus
            }
        });

        // Optional: Emit real-time update
        emitRealtimeUpdate('bookingPaymentUpdated', {
            id: id,
            amountPaid: updatedAmountPaid,
            isPaid: isPaidStatus,
            updatedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error(`Error recording payment for booking ${id}:`, err);
        res.status(500).json({ error: err.message || 'Failed to record payment due to server error.' });
    }
});




// PATCH route to extend a booking
app.patch('/admin/bookings/walk-in/:id/extend', verifyClerkToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { nightsToExtend, paymentAmount } = req.body;

    if (nightsToExtend === undefined || nightsToExtend <= 0 || isNaN(parseInt(nightsToExtend))) {
        return res.status(400).json({ error: 'Valid number of nights to extend is required.' });
    }
    if (paymentAmount === undefined || isNaN(parseFloat(paymentAmount))) {
        return res.status(400).json({ error: 'Valid payment amount is required.' });
    }

    try {
        // 1. Fetch current booking details, including room price per night
        const [existingBookings] = await walkInBookingDb.execute(`
            SELECT
                wb.checkOutDateAndTime,
                wb.totalPrice,
                wb.amountPaid,
                wb.nights,
                r.pricePerNight
            FROM
                bookings wb
            JOIN
                room_management_db.rooms r ON wb.roomTypeId = r.id
            WHERE
                wb.id = ?
        `, [id]);

        if (existingBookings.length === 0) {
            return res.status(404).json({ error: 'Booking not found.' });
        }

        const existingBooking = existingBookings[0];
        const currentCheckOutDate = new Date(existingBooking.checkOutDateAndTime);
        const currentTotalPrice = parseFloat(existingBooking.totalPrice || 0);
        const currentAmountPaid = parseFloat(existingBooking.amountPaid || 0);
        const currentNights = parseInt(existingBooking.nights || 0);
        const pricePerNight = parseFloat(existingBooking.pricePerNight || 0);

        // Calculate new checkout date
        const newCheckOutDate = addDays(currentCheckOutDate, parseInt(nightsToExtend));
        const newCheckOutDateString = format(newCheckOutDate, 'yyyy-MM-dd HH:mm:ss'); // Format for MySQL DATETIME

        // Calculate additional price for extended nights
        const additionalPrice = parseInt(nightsToExtend) * pricePerNight;

        // Calculate updated total price and amount paid
        const updatedTotalPrice = currentTotalPrice + additionalPrice;
        const updatedAmountPaid = currentAmountPaid + parseFloat(paymentAmount);

        // Determine new 'isPaid' status
        let newIsPaidStatus;
        if (updatedAmountPaid >= updatedTotalPrice) {
            newIsPaidStatus = 'Fully Paid';
        } else if (updatedAmountPaid > 0 && updatedAmountPaid < updatedTotalPrice) {
            newIsPaidStatus = 'Partial';
        } else {
            newIsPaidStatus = 'Not Paid';
        }

        // Set status to 'Active' to avoid truncation if 'Extended' is too long for DB column
        // If you want to use 'Extended' specifically, please alter your database table:
        // ALTER TABLE bookings MODIFY COLUMN status VARCHAR(20); (or a suitable length)
        const newStatus = 'Extended';
        const updatedNights = currentNights + parseInt(nightsToExtend);

        // 2. Update the booking in the database
        const [result] = await walkInBookingDb.execute(
            `UPDATE bookings SET
                checkOutDateAndTime = ?,
                totalPrice = ?,
                amountPaid = ?,
                isPaid = ?,
                status = ?,
                nights = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [newCheckOutDateString, updatedTotalPrice, updatedAmountPaid, newIsPaidStatus, newStatus, updatedNights, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Booking not found or no changes made.' });
        }

        res.json({
            message: 'Booking extended successfully!',
            updatedBooking: {
                id: id,
                checkOutDateAndTime: newCheckOutDateString,
                totalPrice: updatedTotalPrice,
                amountPaid: updatedAmountPaid,
                isPaid: newIsPaidStatus,
                status: newStatus,
                nights: updatedNights
            }
        });

        // Optional: Emit real-time update
        emitRealtimeUpdate('bookingExtended', {
            id: id,
            checkOutDateAndTime: newCheckOutDateString,
            totalPrice: updatedTotalPrice,
            amountPaid: updatedAmountPaid,
            isPaid: newIsPaidStatus,
            status: newStatus,
            nights: updatedNights,
            updatedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error(`Error extending booking ${id}:`, err);
        res.status(500).json({ error: err.message || 'Failed to extend booking due to server error.' });
    }
});


// PATCH route to mark a booking as checked out
app.patch('/admin/bookings/walk-in/:id/checkout', verifyClerkToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const actualCheckOutTime = new Date(); // Use current time for actual checkout

    try {
        // Get booking details including physicalRoomId, checkOutDateAndTime, and totalPrice
        const [bookingRows] = await walkInBookingDb.execute(
            `SELECT physicalRoomId, checkOutDateAndTime, totalPrice FROM bookings WHERE id = ?`,
            [id]
        );
        if (bookingRows.length === 0) {
            return res.status(404).json({ error: 'Walk-in booking not found.' });
        }
        const booking = bookingRows[0];

        // Check if the booking is already checked out or in an invalid status
        if (booking.status === 'Checked-Out') { // Assuming 'Checked-Out' is the final status
            return res.status(400).json({ error: 'Walk-in booking is already checked out.' });
        }

        let lateCheckOutFee = 0;
        const scheduledCheckOutDate = new Date(booking.checkOutDateAndTime);
        // Assuming standard checkout time is 12:00 PM (noon)
        scheduledCheckOutDate.setHours(12, 0, 0, 0);


        // Calculate late check-out fee if actualCheckOutTime is after scheduledCheckOutDate
        if (isAfter(actualCheckOutTime, scheduledCheckOutDate)) {
             const lateMs = actualCheckOutTime.getTime() - scheduledCheckOutDate.getTime();
            const lateHoursRoundedUp = Math.ceil(lateMs / (1000 * 60 * 60)); // bill as 1 hour immediately past noon
            lateCheckOutFee = Math.max(0, lateHoursRoundedUp) * 100; // ₱100 per hour, rounded up
            console.log(`[SERVER] Late Check-out detected for walk-in booking ${id}: ${lateHoursRoundedUp} hours late (rounded). Fee: ₱${lateCheckOutFee}`);
        }

        const newTotalPrice = parseFloat(booking.totalPrice) + lateCheckOutFee;

        // Update booking status to 'Checked-Out' and set actualCheckOutTime, lateCheckOutFee, and newTotalPrice
        await walkInBookingDb.execute(
            `UPDATE bookings SET status = ?, checkOutDateAndTime = ?, lateCheckOutFee = ?, totalPrice = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            ['Checked-Out', actualCheckOutTime, lateCheckOutFee, newTotalPrice, id]
        );

        // If a physical room was assigned, make it available again
        if (booking.physicalRoomId) {
            await roomDb.execute(
                `UPDATE room_management_db.physical_rooms SET status = ? WHERE id = ?`,
                ['available', booking.physicalRoomId]
            );
            console.log(`[SERVER] Physical room (ID: ${booking.physicalRoomId}) marked as available due to walk-in booking checkout.`);
        }

        // Removed transaction calls (rollback, commit, release) as walkInBookingDb is a direct connection.

        io.emit('bookingCheckedOut', {
            id: id,
            isWalkIn: true,
            status: 'Checked-Out',
            physicalRoomId: booking.physicalRoomId,
            lateCheckOutFee: lateCheckOutFee, // Include the new fee
            totalPrice: newTotalPrice, // Include the updated total price
            actualCheckOutTime: actualCheckOutTime.toISOString(),
            updatedAt: new Date().toISOString()
        });
        res.json({ message: 'Walk-in booking marked as checked out successfully.', lateCheckOutFee, newTotalPrice });

    } catch (error) {
        console.error("Error checking out walk-in booking:", error);
        res.status(500).json({ error: error.message || 'Failed to check out walk-in booking.' });
    }
});

app.get('/api/walk-in-user-profile/:bookingId', verifyClerkToken, async (req, res) => {
    const { bookingId } = req.params;
    console.log(`Backend: Received request for walk-in user profile with bookingId: ${bookingId}`);
    try {
        const [rows] = await walkInBookingDb.execute(
            'SELECT firstName AS first_name, lastName AS last_name, email, phone, idPictureUrl AS id_picture_url FROM bookings WHERE id = ?',
            [bookingId]
        );
        console.log(`Backend: walkInBookingDb query result for booking id ${bookingId}:`, rows);

        if (rows.length === 0) {
            console.log(`Backend: No walk-in user found for bookingId: ${bookingId}`);
            return res.status(404).json({ error: 'Walk-in user profile not found.' });
        }

        // Add a flag to indicate it's a walk-in user for frontend distinction
        res.json({ ...rows[0], isWalkIn: true });
    } catch (error) {
        console.error("Error fetching walk-in user profile:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// NEW: Admin route to fetch all walk-in bookings
app.get('/admin/walk-in-bookings', verifyClerkToken, requireAdmin, async (req, res) => {
    try {
        let [walkInBookings] = await walkInBookingDb.query(`
            SELECT
                wb.id,
                wb.firstName,
                wb.lastName,
                wb.email,
                wb.phone,
                wb.roomTypeId,
                wb.physicalRoomId,
                wb.checkInDateAndTime,
                wb.guests,
                wb.nights,
                wb.earlyCheckInFee,
                wb.lateCheckOutFee,
                wb.roomPrice,
                wb.totalPrice,
                wb.idPictureUrl,
                wb.isPaid,
                wb.amountPaid,
                wb.status,
                wb.checkOutDateAndTime,
                wb.created_at,
                wb.updated_at,
                wb.discount_type,
                wb.discount_amount, -- <--- NEW: Select the discountAmount column
                r.roomType,
                r.pricePerNight,
                pr.room_number AS physicalRoomNumber
            FROM
                bookings wb
            JOIN
                room_management_db.rooms r ON wb.roomTypeId = r.id
            LEFT JOIN
                room_management_db.physical_rooms pr ON wb.physicalRoomId = pr.id
            ORDER BY
                wb.checkInDateAndTime DESC
        `);

        const now = new Date();
        // Process bookings to calculate dynamic lateCheckOutFee for overdue ones
        walkInBookings = walkInBookings.map(booking => {
            const checkOutDateTime = new Date(booking.checkOutDateAndTime);
            let dynamicLateCheckOutFee = parseFloat(booking.lateCheckOutFee || 0);
            let updatedTotalPrice = parseFloat(booking.totalPrice);

            // Only calculate dynamic late fee if the booking is currently 'Checked-In'
            if (booking.status === 'Checked-In' && isAfter(now, checkOutDateTime)) {
                const lateMs = now.getTime() - checkOutDateTime.getTime();
                const lateHoursRoundedUp = Math.ceil(lateMs / (1000 * 60 * 60)); // 1+ hour billed as soon as past noon
                const calculatedHourlyFee = Math.max(0, lateHoursRoundedUp) * 100;


                if (dynamicLateCheckOutFee === 0 || calculatedHourlyFee > dynamicLateCheckOutFee) {
                    dynamicLateCheckOutFee = calculatedHourlyFee;
                    updatedTotalPrice = parseFloat(booking.totalPrice) + dynamicLateCheckOutFee;
                }
            }

            // Use the stored discountAmount directly
            let storedDiscountAmount = parseFloat(booking.discountAmount || 0);

            return {
                ...booking,
                lateCheckOutFee: dynamicLateCheckOutFee,
                totalPrice: updatedTotalPrice,
                discountAmount: storedDiscountAmount.toFixed(2) // Use the directly fetched discountAmount for display
            };
        });

        res.json(walkInBookings);
    } catch (err) {
        console.error("Error fetching walk-in bookings for admin dashboard:", err);
        res.status(500).json({ error: err.message || 'Failed to fetch walk-in bookings' });
    }
});


// ====================================================================
// =========     ONLINE BOOKING MANAGEMENT ROUTES        ===================
// ====================================================================

app.get('/bookings/user/:userId', verifyClerkToken, async (req, res) => {
    const userId = req.params.userId;
    const authenticatedUserId = req.auth.userId;

    console.log(`[SERVER] Received request for user bookings for userId: ${userId}`);

    if (authenticatedUserId !== userId) {
        console.error(`[SERVER] Forbidden: Authenticated user ${authenticatedUserId} tried to access bookings for ${userId}.`);
        return res.status(403).json({ message: "Forbidden: You can only view your own bookings." });
    }

    try {
        const [bookings] = await bookingDb.execute( // Assuming bookingDb is correctly configured for booking_db
            `SELECT
                b.id,
                b.userId,
                b.roomId,
                b.physical_room_id, -- CORRECTED: Changed to physical_room_id
                b.checkInDate,
                b.checkOutDate,
                b.totalPrice,
                b.isPaid,
                b.amountPaid,
                b.guests,
                b.status,
                b.assigned_room_number,
                b.lateCheckOutFee, -- Include late check-out fee for user bookings
                b.actual_check_in_time,
                b.actual_check_out_time,
                b.actualPaymentTime,
                b.payment_reference,
                pr.room_number AS physical_room_number_from_pr,
                rr.rating AS userRating_rating,
                rr.comment AS userRating_comment
            FROM
                bookings b
            LEFT JOIN
                room_management_db.physical_rooms pr ON b.physical_room_id = pr.id -- This line was already correct
            LEFT JOIN
                room_management_db.room_ratings rr ON b.id = rr.bookingId AND rr.userId = ?
            WHERE
                b.userId = ?
            ORDER BY
                b.checkInDate DESC`,
            [userId, userId]
        );

        console.log("[SERVER] Fetched Bookings:", bookings);

        if (bookings.length === 0) {
            console.log("[SERVER] No bookings found for user.");
            return res.json([]);
        }

        const roomIds = [...new Set(bookings.map(booking => booking.roomId))];
        console.log("[SERVER] Extracted Room IDs from bookings:", roomIds);

        let rooms = [];
        if (roomIds.length > 0) {
            const roomIdsPlaceholder = roomIds.map(() => '?').join(',');
            const [fetchedRooms] = await roomDb.execute(
                `SELECT
                    id,
                    roomType,
                    pricePerNight,
                    images,
                    amenities,
                    owner
                FROM
                    rooms
                WHERE
                    id IN (${roomIdsPlaceholder})`,
                roomIds
            );
            rooms = fetchedRooms;
        }

        console.log("[SERVER] Fetched Room Details (after IN (?) fix/check):", rooms);

        const roomsMap = new Map(rooms.map(room => {
            console.log(`[SERVER] Mapping room ${room.id}: roomType='${room.roomType}', images='${room.images}', amenities='${room.amenities}'`);
            const parsedImages = safeParseJSON(room.images, []);
            const parsedAmenities = safeParseJSON(room.amenities, []);
            const parsedOwner = safeParseJSON(room.owner, {});

            const roomAddress = parsedOwner.address || 'Main Road 123 Street, 23 Colony';
            return [room.id, {
                id: room.id,
                roomType: room.roomType,
                pricePerNight: room.pricePerNight,
                images: parsedImages,
                amenities: parsedAmenities,
                owner: parsedOwner,
                address: roomAddress
            }];
        }));
        console.log("[SERVER] Constructed Rooms Map:", roomsMap);

        const processedBookings = bookings.map(booking => {
            const roomDetails = roomsMap.get(booking.roomId);

            const userRating = (booking.userRating_rating !== null || booking.userRating_comment !== null)
                ? { rating: booking.userRating_rating, comment: booking.userRating_comment }
                : null;
            const parsedTotalPrice = parseFloat(booking.totalPrice);
            const parsedAmountPaid = parseFloat(booking.amountPaid || 0);
            let paymentStatus = 'Not Paid';
            if (!isNaN(parsedAmountPaid)) {
                if (parsedAmountPaid >= parsedTotalPrice) {
                    paymentStatus = 'Fully Paid';
                } else if (parsedAmountPaid > 0) {
                    paymentStatus = 'Partial';
                }
            }
            return {
                id: booking.id,
                userId: booking.userId,
                roomTypeId: booking.roomId,
                physicalRoomId: booking.physical_room_id,
                roomType: roomDetails ? roomDetails.roomType : 'Unknown Room',
                pricePerNight: roomDetails ? roomDetails.pricePerNight : 0,
                roomImages: roomDetails ? roomDetails.images : [],
                roomAmenities: roomDetails ? roomDetails.amenities : [],
                owner: roomDetails ? roomDetails.owner : {},
                address: roomDetails ? roomDetails.address : 'Main Road 123 Street, 23 Colony',
                checkInDate: booking.checkInDate,
                checkOutDate: booking.checkOutDate,
                totalPrice: parsedTotalPrice,
                isPaid: paymentStatus === 'Fully Paid',
                paymentStatus,
                amountPaid: parsedAmountPaid,
                guests: booking.guests,
                status: booking.status,
                assigned_room_number: booking.assigned_room_number,
                physicalRoomId: booking.physical_room_id, // CORRECTED: Mapped from physical_room_id
                lateCheckOutFee: parseFloat(booking.lateCheckOutFee || 0), // Include late check-out fee
                actualCheckInTime: booking.actual_check_in_time,
                actualCheckOutTime: booking.actual_check_out_time,
                actualPaymentTime: booking.actualPaymentTime,
                paymentReference: booking.payment_reference || null,
                userRating: userRating
            };
        });

        res.json(processedBookings);

    } catch (err) {
        console.error("[SERVER] Error fetching user bookings:", err);
        if (err.status) {
            return res.status(err.status).json({ error: err.message });
        }
        res.status(500).json({ error: err.message || 'Failed to fetch user bookings' });
    }
});

// NEW: Endpoint to submit a room rating
app.post('/bookings/:bookingId/rate', verifyClerkToken, async (req, res) => {
    const { bookingId } = req.params;
    const { rating, comment, roomId, physicalRoomId } = req.body;
    const userId = req.auth.userId; // Correct: Use req.auth.userId from verifyClerkToken middleware

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be a number between 1 and 5.' });
    }
    if (!roomId) {
        return res.status(400).json({ error: 'Room ID is required for rating.' });
    }

    try {
        // 1. Verify the booking belongs to the user and is 'checked_out'
        const [bookings] = await bookingDb.execute( // Use bookingDb for bookings table
            'SELECT * FROM bookings WHERE id = ? AND userId = ? AND status = ?',
            [bookingId, userId, 'checked_out']
        );

        if (bookings.length === 0) {
            // No need to rollback here since no transaction was started on direct connections
            return res.status(403).json({ error: 'Booking not found, does not belong to you, or is not yet checked out.' });
        }

        // 2. Check if the user has already rated this booking in room_management_db
        const [existingRating] = await roomDb.execute( // Use roomDb for room_ratings table
            'SELECT id FROM room_ratings WHERE bookingId = ? AND userId = ?',
            [bookingId, userId]
        );

        if (existingRating.length > 0) {
            // If exists, update the rating
            await roomDb.execute( // Use roomDb for room_ratings table
                'UPDATE room_ratings SET rating = ?, comment = ?, updated_at = CURRENT_TIMESTAMP WHERE bookingId = ? AND userId = ?',
                [rating, comment, bookingId, userId]
            );
            // No need for commit on direct connections
            res.status(200).json({ message: 'Rating updated successfully.' });
        } else {
            // If not exists, insert new rating
            await roomDb.execute( // Use roomDb for room_ratings table
                'INSERT INTO room_ratings (bookingId, userId, roomId, physicalRoomId, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
                [bookingId, userId, roomId, physicalRoomId, rating, comment]
            );
            // No need for commit on direct connections
            res.status(201).json({ message: 'Room rated successfully!' });
        }

        // Emit socket event for real-time update (optional, but good practice)
        // Ensure 'io' object is accessible in this scope (it usually is if defined globally)
        io.emit('roomRated', { bookingId, userId, rating, comment, roomId });

    } catch (err) {
        // No need for rollback on direct connections, but log the error
        console.error('Error submitting room rating:', err);
        res.status(500).json({ error: err.message || 'Failed to submit room rating.' });
    } finally {
        // Direct connections initialized with createConnection do not have a .release() method.
        // They typically persist for the application's lifetime unless explicitly closed.
        // If you want to release connections, you must use createPool and pool.getConnection().
        // For now, removing the .release() calls to prevent the error.
    }
});
// ... (rest of the code)

// NEW: PATCH route to handle cash payment for online bookings
app.patch('/admin/bookings/:id/pay-in-cash', verifyClerkToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    
    console.log(`Admin user ${req.auth.userId} is marking online booking ${id} as paid in cash.`);

    try {
        // 1. Fetch the booking
        const [bookings] = await bookingDb.execute('SELECT * FROM bookings WHERE id = ?', [id]);
        if (bookings.length === 0) {
            return res.status(404).json({ error: 'Booking not found.' });
        }
        const booking = bookings[0];

        // 2. Validate the booking status
        if (booking.status === 'paid') {
            return res.status(400).json({ error: 'Booking is already paid.' });
        }
    
        // 4. Fetch the updated booking to emit the complete data
        const [updatedBookings] = await bookingDb.execute('SELECT * FROM bookings WHERE id = ?', [id]);
        const updatedBooking = updatedBookings[0];

        // 5. Emit a real-time update
        emitRealtimeUpdate('bookingPaid', updatedBooking);

        res.status(200).json({ message: 'Online booking marked as paid in cash.', updatedBooking });
    } catch (err) {
        console.error('Error processing cash payment for online booking:', err);
        res.status(500).json({ error: err.message || 'Failed to process cash payment.' });
    }
});

// NEW: Endpoint to mark a booking as paid (user can trigger)
app.patch('/bookings/:id/mark-paid', verifyClerkToken, async (req, res) => {
    const bookingId = req.params.id;
    const { userId } = req.auth; // Get userId from Clerk auth
    const { referenceNumber } = req.body || {};

    try {
        const [bookingRows] = await bookingDb.execute(
            `SELECT * FROM bookings WHERE id = ? AND userId = ?`,
            [bookingId, userId]
        );

        if (bookingRows.length === 0) {
            return res.status(404).json({ error: 'Booking not found or not authorized' });
        }

        const booking = bookingRows[0];

        
        if (booking.status !== 'approved') {
            return res.status(400).json({ error: 'Only approved bookings can be marked as paid' });
        }

        // Update booking to paid
        await bookingDb.execute(
            `UPDATE bookings SET payment_reference = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [referenceNumber || null, bookingId]
        );
         res.json({ message: 'Payment reference submitted for verification.' });

        // Optional: notify admins that a new payment reference was submitted
        emitRealtimeUpdate('paymentReferenceSubmitted', {
            id: bookingId,
            userId: booking.userId,
            paymentReference: referenceNumber || null,
            updatedAt: new Date().toISOString()
        });

    } catch (err) {
       console.error("[SERVER] Error submitting payment reference:", err);
        res.status(500).json({ error: err.message || 'Failed to submit payment reference' });
    }
});


app.post('/check-availability', async (req, res) => {
    const { roomId, checkInDate, checkOutDate, guests } = req.body;
    console.log(`Checking availability for Room Type ID: ${roomId}, Dates: ${checkInDate} to ${checkOutDate}, Guests: ${guests}`);

    try {
        // 1. Get the total number of physical rooms for this roomTypeId
        const [physicalRoomsCountResult] = await roomDb.execute(
            'SELECT COUNT(*) AS totalPhysicalRooms FROM room_management_db.physical_rooms WHERE room_type_id = ?',
            [roomId]
        );
        const totalPhysicalRooms = physicalRoomsCountResult[0].totalPhysicalRooms;

        if (totalPhysicalRooms === 0) {
            return res.json({ available: false, message: 'No rooms exist for this room type.' });
        }

        // 2. Get the number of physical rooms booked for ANY part of the requested date range from both databases.
        const [bookedRoomsResult] = await roomDb.execute(
            `
            SELECT COUNT(DISTINCT booked_room_alias) AS bookedCount
            FROM (
                -- Check online bookings (using physical_room_id and DATE columns)
                SELECT b.physical_room_id AS booked_room_alias
                FROM booking_db.bookings b
                JOIN room_management_db.physical_rooms pr ON b.physical_room_id = pr.id
                WHERE pr.room_type_id = ?
                AND (b.checkOutDate > ? AND b.checkInDate < ?)
                
                UNION
                
                -- Check walk-in bookings (using physicalRoomId and DATETIME columns)
                SELECT b.physicalRoomId AS booked_room_alias
                FROM walk_in_booking_db.bookings b
                JOIN room_management_db.physical_rooms pr ON b.physicalRoomId = pr.id
                WHERE pr.room_type_id = ?
                AND (b.checkOutDateAndTime > ? AND b.checkInDateAndTime < ?)
            ) AS booked_rooms
            `,
            [
                roomId, checkInDate, checkOutDate,
                roomId, checkInDate, checkOutDate
            ]
        );
        const bookedPhysicalRooms = bookedRoomsResult[0].bookedCount;

        console.log(`Total Physical Rooms for type ${roomId}: ${totalPhysicalRooms}`);
        console.log(`Physical Rooms Booked for requested dates: ${bookedPhysicalRooms}`);

        // 3. Calculate actual available physical rooms
        const availablePhysicalRooms = totalPhysicalRooms - bookedPhysicalRooms;

        if (availablePhysicalRooms > 0) {
            // Further check if the room type can accommodate the number of guests
            const [roomTypeResult] = await roomDb.execute(
                'SELECT maxGuests FROM room_management_db.rooms WHERE id = ?',
                [roomId]
            );
            const maxGuests = roomTypeResult[0]?.maxGuests;

            if (guests > maxGuests) {
                return res.json({ available: false, message: `This room type only accommodates a maximum of ${maxGuests} guests.` });
            }
            
            // Now, get the available physical room numbers to display in the dropdown
            const [availablePhysicalRoomsDetails] = await roomDb.execute(
                `
                SELECT id, room_number
                FROM room_management_db.physical_rooms
                WHERE room_type_id = ?
                AND id NOT IN (
                    -- Check online bookings (using physical_room_id and DATE columns)
                    SELECT b.physical_room_id
                    FROM booking_db.bookings b
                    WHERE b.physical_room_id IN (SELECT id FROM room_management_db.physical_rooms WHERE room_type_id = ?)
                    AND (b.checkOutDate > ? AND b.checkInDate < ?)
                    
                    UNION
                    
                    -- Check walk-in bookings (using physicalRoomId and DATETIME columns)
                    SELECT b.physicalRoomId
                    FROM walk_in_booking_db.bookings b
                    WHERE b.physicalRoomId IN (SELECT id FROM room_management_db.physical_rooms WHERE room_type_id = ?)
                    AND (b.checkOutDateAndTime > ? AND b.checkInDateAndTime < ?)
                )
                `,
                [
                    roomId,
                    roomId, checkInDate, checkOutDate,
                    roomId, checkInDate, checkOutDate
                ]
            );

            return res.json({
                available: true,
                message: `A room is available for your selected dates. ${availablePhysicalRooms} rooms remaining.`,
                availablePhysicalRooms: availablePhysicalRoomsDetails
            });
        } else {
            res.json({ available: false, message: 'All physical rooms for this type are booked for these dates.' });
        }

    } catch (err) {
        console.error("Error checking availability:", err);
        res.status(500).json({ error: err.message || 'Failed to check availability.' });
    }
});

app.get('/bookings/room/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        // Only return approved/pending bookings that block availability
        const [bookings] = await bookingDb.query(
            "SELECT checkInDate, checkOutDate FROM bookings WHERE roomId = ? AND (status = 'approved' OR status = 'pending')",
            [roomId]
        );
        res.json(bookings);
    } catch (err) {
        console.error('Error fetching bookings for room:', err);
        res.status(500).json({ error: 'Failed to fetch room bookings' });
    }
});

app.post('/bookings', verifyClerkToken, async (req, res) => {
    let { userId, roomId, checkInDate, checkOutDate, totalPrice, guests, isPaid = false, actualCheckInTime } = req.body;

    const authenticatedUserId = req.auth.userId;

    if (!authenticatedUserId || authenticatedUserId !== userId) {
        return res.status(403).json({ message: "Unauthorized: User ID mismatch or missing. Please ensure the user is authenticated and the ID is sent." });
    }

    if (!roomId || !checkInDate || !checkOutDate || totalPrice === undefined || guests === undefined) {
        return res.status(400).json({ error: 'Missing required booking details.' });
    }

    const checkInDateObj = new Date(checkInDate);
    // Set the check-in time to 2:00 PM (14:00 in 24-hour format)
    checkInDateObj.setHours(14, 0, 0, 0);

    const requestedActualCheckInTime = actualCheckInTime ? new Date(actualCheckInTime) : null;

    const checkOutDateObj = new Date(checkOutDate);
    // Set to 12:00:00.000 (PM) local time
    checkOutDateObj.setHours(12, 0, 0, 0);

    // *** NEW MODIFICATION START: Format for MySQL DATETIME ***
    // This function will format the Date object into 'YYYY-MM-DD HH:mm:ss'
    // This is robust for MySQL DATETIME columns that don't directly handle ISO Z suffix well.
    const formatForMySQLDatetime = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    // Apply the formatting function to both check-in and check-out dates
    const formattedCheckInDate = formatForMySQLDatetime(checkInDateObj);
    const formattedCheckOutDate = formatForMySQLDatetime(checkOutDateObj);
    // *** NEW MODIFICATION END ***

    // --- Calculate Nights based on 22-hour rule ---
    // You need to ensure 'differenceInHours' is imported from 'date-fns' if not already.
    // e.g., const { format, differenceInDays, addDays, differenceInHours, isAfter } = require('date-fns');
    const durationInHours = differenceInHours(checkOutDateObj, checkInDateObj);
    let nights = 0;
    if (durationInHours >= 22) {
        // For simplicity, assuming a single night scenario as per your example (2pm to 12pm next day = 22 hours)
        // For multiple nights, you'd calculate days and adjust.
        // Example: If 22 hours counts as 1 night, then 46 hours might count as 2 nights (22 + 24)
        // A more robust multi-night calculation would be:
        // const durationInDays = differenceInDays(checkOutDateObj, checkInDateObj);
        // nights = durationInDays;
        // if (durationInHours % 24 >= 22 && durationInHours % 24 < 24) { // if the remaining partial day is 22-23 hours
        //    nights += 1;
        // }
        // For your specific request of "22 hours only" for 1 night:
        nights = Math.ceil(durationInHours / 22); // This will count 22-44 hours as 1 night, 45-66 as 2 nights etc.
                                                  // Or if it's strictly about 22 hours for *one* night:
                                                  // nights = durationInHours >= 22 ? 1 : 0; // This would only count 1 night if >= 22 hours, otherwise 0.
                                                  // Let's go with a more general approach for now, assuming 22 hours is the minimum for a full night.
        nights = Math.max(1, Math.floor(durationInHours / 24)); // Calculate full 24-hour periods
        if (durationInHours % 24 >= 22) { // If there's a partial day of 22+ hours, count it as an extra night
            nights += 1;
        }
        if (nights === 0 && durationInHours > 0) { // If less than 22 hours but more than 0, still count as 1 night (e.g., day use)
            nights = 1;
        }
    }


    const initialStatus = 'pending';

    const query = `
        INSERT INTO bookings (userId, roomId, checkInDate, checkOutDate, totalPrice, isPaid, guests, status, actual_check_in_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    try {
        const [result] = await bookingDb.execute(query, [
            authenticatedUserId,
            roomId,
            formattedCheckInDate,
            formattedCheckOutDate,
            totalPrice,
            isPaid ? 1 : 0,
            guests,
            initialStatus,
            requestedActualCheckInTime,
        ]);
        res.status(201).json({ message: 'Booking added successfully', bookingId: result.insertId, status: initialStatus });

        emitRealtimeUpdate('newBookingCreated', {
            id: result.insertId,
            userId: authenticatedUserId,
            roomId: roomId,
            checkInDate: formattedCheckInDate,
            checkOutDate: formattedCheckOutDate,
            totalPrice: parseFloat(totalPrice),
            guests: guests,
            isPaid: isPaid,
            status: initialStatus,
            actualCheckInTime: requestedActualCheckInTime,
            createdAt: new Date().toISOString(),
        });

    } catch (err) {
        console.error("Error adding booking:", err);
        res.status(500).json({ error: err.message || 'Failed to add booking' });
    }
});

app.patch('/bookings/:id/extend', ClerkExpressRequireAuth(), async (req, res) => {
    const bookingId = req.params.id; // The ID of the original booking
    const { nights } = req.body;
    const clerkUserId = req.auth.userId;

    // ... (input validation for nights) ...

    let bookingConnection;
    let roomConnection; // Get a connection for the room_management_db
    try {
        bookingConnection = await bookingDb.getConnection();
        roomConnection = await roomDb.getConnection(); // Acquire room management DB connection
        await bookingConnection.beginTransaction(); // Transaction for booking_db changes

        // 1. Fetch original booking details from booking_db
        const [bookings] = await bookingConnection.execute(
            `SELECT * FROM bookings WHERE id = ? AND userId = ?`,
            [bookingId, clerkUserId]
        );
        if (bookings.length === 0) {
            await bookingConnection.rollback();
            return res.status(404).json({ error: 'Original booking not found or not owned by user.' });
        }
        const originalBooking = bookings[0];

        // ... (status validation for originalBooking) ...

        // 2. Validate roomId by querying room_management_db
        const [rooms] = await roomConnection.execute( // Use roomDb connection here
            `SELECT pricePerNight FROM rooms WHERE id = ?`,
            [originalBooking.roomId]
        );
        if (rooms.length === 0) {
            await bookingConnection.rollback(); // Rollback bookingDb transaction
            return res.status(404).json({ error: 'Referenced room not found in room management database.' });
        }
        const pricePerNight = parseFloat(rooms[0].pricePerNight);

        // 3. Calculate new check-out date for the EXTENSION period
        const extensionCheckInDate = new Date(originalBooking.checkOutDate);
        extensionCheckInDate.setUTCHours(0,0,0,0);
        const extensionCheckOutDate = new Date(extensionCheckInDate);
        extensionCheckOutDate.setDate(extensionCheckInDate.getDate() + parseInt(nights));

        // 4. Perform availability check:
        //    a. Check physical room availability (if applicable) in room_management_db.
        //       (This example assumes physicalRoomId from originalBooking is used)
        if (originalBooking.physical_room_id) {
            const [physicalRoomStatus] = await roomConnection.execute(
                `SELECT status FROM physical_rooms WHERE id = ?`,
                [originalBooking.physical_room_id]
            );
            if (physicalRoomStatus.length === 0 || physicalRoomStatus[0].status !== 'available') {
                 await bookingConnection.rollback();
                 return res.status(409).json({ error: 'Assigned physical room is not available for extension.' });
            }
            // More robust check: ensure the physical room is free for the entire extended period
            // This would involve looking at other bookings that might use this physical room
        }


        //    b. Check conceptual room (roomId) availability by looking at existing bookings in booking_db
        //       (Your existing logic to check for conflicting bookings in the bookings table would go here)
        const [conflictingBookings] = await bookingConnection.execute( // Use bookingDb connection here
            `SELECT id FROM bookings
             WHERE roomId = ? -- This roomId refers to the conceptual room from room_management_db
             AND id != ?
             AND status IN ('pending', 'approved')
             AND (
                 (checkInDate < ? AND checkOutDate > ?)
             )`,
            [originalBooking.roomId, originalBooking.id, extensionCheckOutDate, extensionCheckInDate]
        );

        if (conflictingBookings.length > 0) {
            await bookingConnection.rollback();
            return res.status(409).json({ error: 'Room type not available for the requested extension period.' });
        }

        const extensionPrice = parseInt(nights) * pricePerNight;

        // 5. Create a NEW booking_extension record in booking_db
        const [extensionResult] = await bookingConnection.execute( // Use bookingDb connection here
            `INSERT INTO booking_extensions (originalBookingId, userId, roomId, physicalRoomId, extensionCheckInDate, extensionCheckOutDate, extensionNights, extensionPrice, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                originalBooking.id,
                clerkUserId,
                originalBooking.roomId,      // roomId from room_management_db, but stored as INT in booking_db
                originalBooking.physical_room_id, // physicalRoomId from room_management_db, stored as INT
                extensionCheckInDate.toISOString(),
                extensionCheckOutDate.toISOString(),
                parseInt(nights),
                extensionPrice.toFixed(2),
                'pending'
            ]
        );
        const newExtensionId = extensionResult.insertId;

        await bookingConnection.commit(); // Commit bookingDb changes

        // ... (Emit real-time update) ...

        res.json({ message: `Extension request submitted. Awaiting admin approval and payment for extension.`, extensionId: newExtensionId });

    } catch (err) {
        if (bookingConnection) {
            await bookingConnection.rollback();
        }
        console.error(`Error processing extension request for booking ${bookingId}:`, err);
        res.status(500).json({ error: err.message || 'Failed to submit extension request' });
    } finally {
        if (bookingConnection) {
            bookingConnection.release();
        }
    }
});

// NEW: Endpoint for users to request check-out
app.post('/bookings/:id/request-check-out', ClerkExpressRequireAuth(), async (req, res) => {
    const bookingId = req.params.id;
    const clerkUserId = req.auth.userId;

    let bookingConnection;
    try {
        bookingConnection = await bookingDb.getConnection();
        await bookingConnection.beginTransaction();

        // 1. Fetch booking details and verify ownership and status
        const [bookings] = await bookingConnection.execute(
            `SELECT * FROM bookings WHERE id = ? AND userId = ?`,
            [bookingId, clerkUserId]
        );

        if (bookings.length === 0) {
            await bookingConnection.rollback();
            return res.status(404).json({ error: 'Booking not found or not owned by user.' });
        }
        const booking = bookings[0];

        // Ensure booking is currently checked_in
        if (booking.status !== 'checked_in') {
            await bookingConnection.rollback();
            return res.status(400).json({ error: `Cannot request check-out for a booking with status '${booking.status}'. Only 'checked_in' bookings can request check-out.` });
        }

        // Ensure a request isn't already pending
        if (booking.status === 'check_out_requested') {
            await bookingConnection.rollback();
            return res.status(400).json({ error: 'Check-out request for this booking is already pending.' });
        }

        // 2. Update booking status to 'check_out_requested'
        const [result] = await bookingConnection.execute(
            `UPDATE bookings SET status = 'check_out_requested', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [bookingId]
        );

        if (result.affectedRows === 0) {
            await bookingConnection.rollback();
            return res.status(500).json({ error: 'Failed to update booking status to check_out_requested.' });
        }

        await bookingConnection.commit();

        // 3. Emit real-time update to admin dashboard
        io.emit('checkOutRequested', {
            id: bookingId,
            userId: clerkUserId,
            status: 'check_out_requested',
            message: `Check-out requested for booking ${bookingId}.`
        });

        res.json({ message: `Check-out request submitted for booking ${bookingId}. Please wait for admin approval.` });

    } catch (err) {
        if (bookingConnection) {
            await bookingConnection.rollback();
        }
        console.error(`Error submitting check-out request for booking ${bookingId}:`, err);
        res.status(500).json({ error: err.message || 'Failed to submit check-out request' });
    } finally {
        if (bookingConnection) {
            bookingConnection.release();
        }
    }
});

app.get('/bookings/physical-room/:id', verifyClerkToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await bookingDb.execute(
            'SELECT * FROM bookings WHERE physical_room_id = ? ORDER BY checkInDate DESC',
            [id]
        );
        res.json(rows);
    } catch (err) {
        console.error(`Error fetching bookings for physical room ${id}:`, err);
        res.status(500).json({ error: `Failed to fetch bookings for physical room ${id}` });
    }
});

app.patch('/bookings/:id/cancel', verifyClerkToken, async (req, res) => {
    const bookingId = req.params.id;
    const { userId } = req.auth;

    try {

        const [bookingRows] = await bookingDb.execute(
            `SELECT physical_room_id, userId, status FROM bookings WHERE id = ? FOR UPDATE`,
            [bookingId]
        );

        if (bookingRows.length === 0) {
            await bookingDb.rollback(); // Rollback transaction if booking not found
            return res.status(404).json({ error: 'Booking not found.' });
        }

        const booking = bookingRows[0];

        // Check if the current user is the owner or an admin
        let isAdmin = false;
        try {
            // Assuming clerkClient and its users.getUser method are correctly initialized
            const user = await clerkClient.users.getUser(userId);
            if (user.publicMetadata && user.publicMetadata.role === 'admin') {
                isAdmin = true;
            }
        } catch (clerkErr) {
            // Log a warning if Clerk verification fails, but don't stop the process
            console.warn(`[server.js] Could not verify admin role for userId ${userId}: ${clerkErr.message}`);
        }

        // Authorization check: User must be the booking owner or an admin
        if (booking.userId !== userId && !isAdmin) {
            await bookingDb.rollback(); // Rollback due to unauthorized access
            return res.status(403).json({ error: 'Unauthorized: You can only cancel your own bookings.' });
        }

        // Business logic: Only allow cancellation if status is 'pending'
        if (booking.status !== 'pending') {
            await bookingDb.rollback(); // Rollback if booking is not in a cancellable state
            return res.status(400).json({ error: `Booking cannot be cancelled. Current status is '${booking.status}'.` });
        }

        // 2. Update booking status to 'cancelled' in the booking database
        const [result] = await bookingDb.execute(
            `UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [bookingId]
        );

        if (result.affectedRows === 0) {
            await bookingDb.rollback(); // Rollback if no rows were affected (e.g., booking ID mismatch)
            return res.status(500).json({ error: 'Failed to cancel booking.' });
        }

        // 3. If a physical room was assigned, mark it as 'available' again in the room database
        if (booking.physical_room_id) {
            // This update uses the roomConnection, which is separate from the bookingConnection's transaction.
            // If atomicity across databases is critical, consider distributed transactions or a compensating action.
            await roomDb.execute(
                `UPDATE physical_rooms SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [booking.physical_room_id]
            );
            console.log(`[SERVER] Physical room (ID: ${booking.physical_room_id}) marked as available due to booking cancellation.`);
        }

        await bookingDb.commit(); // Commit the transaction if all operations are successful

        // Send success response to the client
        res.json({ message: `Booking ${bookingId} cancelled successfully.` });

        // Emit real-time update using a function that is assumed to be defined elsewhere (e.g., via websockets)
        // This is typically a non-blocking operation.
        emitRealtimeUpdate('bookingCancelled', {
            id: bookingId,
            userId: booking.userId,
            physicalRoomId: booking.physical_room_id,
            status: 'cancelled',
            updatedAt: new Date().toISOString() // Provide current timestamp
        });

    } catch (err) {
        // Rollback the transaction if any error occurs during the process
        if (bookingDb) {
            await bookingDb.rollback();
        }
        console.error(`Error cancelling booking ${bookingId}:`, err);
        // Send a 500 status with an informative error message
        res.status(500).json({ error: err.message || 'Failed to cancel booking' });
    } finally {
        // IMPORTANT: ALWAYS release connections back to their respective pools
        // This ensures connections are reused and prevents resource leaks.
        if (bookingDb) bookingDb.release();
        if (roomDb) roomDb.release();
    }
});

app.patch('/admin/bookings/:id/record-payment', verifyClerkToken, requireAdmin, async (req, res) => {
    const bookingId = req.params.id;
    const { amountPaid } = req.body;

    console.log(`[💰 PATCH] Recording payment for booking ID: ${bookingId}`);
    console.log(`[💰] Requested amountPaid:`, amountPaid);

    if (!amountPaid || isNaN(amountPaid)) {
        console.error(`[❌] Invalid amountPaid:`, amountPaid);
        return res.status(400).json({ error: 'Invalid payment amount.' });
    }

    try {
        const [rows] = await bookingDb.execute(
            'SELECT totalPrice, amountPaid FROM bookings WHERE id = ?',
            [bookingId]
        );

        if (rows.length === 0) {
            console.error(`[❌] Booking not found with ID: ${bookingId}`);
            return res.status(404).json({ error: 'Booking not found.' });
        }

        const current = rows[0];
        console.log(`[✅] Booking Found. Current Paid: ${current.amountPaid}, Total: ${current.totalPrice}`);

        const newAmountPaid = parseFloat(current.amountPaid) + parseFloat(amountPaid);
        const totalPrice = parseFloat(current.totalPrice);

        let isPaidStatus = 'Not Paid';
        if (newAmountPaid >= totalPrice) {
            isPaidStatus = 'Fully Paid';
        } else if (newAmountPaid > 0) {
            isPaidStatus = 'Partial';
        }

        console.log(`[💾] Updating booking... New AmountPaid: ${newAmountPaid}, Status: ${isPaidStatus}`);

        await bookingDb.execute(
            'UPDATE bookings SET amountPaid = ?, isPaid = ?, actualPaymentTime = NOW() WHERE id = ?',
            [newAmountPaid.toFixed(2), isPaidStatus, bookingId]
        );

        const [updated] = await bookingDb.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);

        console.log(`[✅] Updated booking:`, updated[0]);

        emitRealtimeUpdate('bookingPaymentUpdated', updated[0]);

        res.status(200).json({ message: 'Payment recorded successfully.', booking: updated[0] });
    } catch (error) {
        console.error('Error recording cash payment:', error);
        res.status(500).json({ error: 'Failed to record cash payment.' });
    }
});


// ====================================================================
// ADMIN DASHBOARD ROUTES - NEWLY ADDED/FIXED
// ====================================================================

// GET /admin/dashboard-summary

app.get('/admin/dashboard-summary', verifyClerkToken, requireAdmin, async (req, res) => {
    try {
        const [totalUsersRows] = await userDb.execute('SELECT COUNT(*) AS count FROM users');
        const totalUsers = totalUsersRows[0].count;

        const [totalRoomsRows] = await roomDb.execute('SELECT COUNT(*) AS count FROM rooms');
        const totalRooms = totalRoomsRows[0].count;

        // Calculate total online bookings
        const [totalOnlineBookingsRows] = await bookingDb.execute('SELECT COUNT(*) AS count FROM bookings');
        const totalOnlineBookings = totalOnlineBookingsRows[0].count;

        // Calculate total walk-in bookings
        const [totalWalkInBookingsRows] = await walkInBookingDb.execute('SELECT COUNT(*) AS count FROM bookings');
        const totalWalkInBookings = totalWalkInBookingsRows[0].count;

        // Combine total bookings for the dashboard summary card
        const totalBookingsCombined = totalOnlineBookings + totalWalkInBookings;

        // Calculate revenue from online bookings by summing amountPaid
        // This supports Partial/Fully/Not Paid tri-state and avoids dependence on isPaid flag type
        const [onlineRevenueRows] = await bookingDb.execute(
           "SELECT SUM(amountPaid) AS revenue FROM bookings WHERE status != 'rejected' AND status != 'cancelled'"
        );
        const onlineRevenue = onlineRevenueRows[0].revenue || 0;

        // Calculate revenue from walk-in bookings
        // This query already seems to correctly sum 'amountPaid' for non-rejected/non-cancelled bookings.
        const [walkInRevenueRows] = await walkInBookingDb.execute(
            `SELECT SUM(amountPaid) AS revenue FROM bookings WHERE status != 'rejected' AND status != 'cancelled'`
        );
        const walkInRevenue = walkInRevenueRows[0].revenue || 0;

        // Combine total revenue from both online and walk-in bookings
        const totalRevenue = parseFloat(onlineRevenue) + parseFloat(walkInRevenue);

        res.json({
            totalUsers,
            totalRooms,
            totalBookings: totalBookingsCombined,
            totalOnlineBookings,
            totalWalkInBookings,
            totalRevenue: totalRevenue.toFixed(2)
        });
    } catch (error) {
        console.error("Error fetching dashboard summary:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// GET /admin/users
app.get('/admin/users', verifyClerkToken, requireAdmin, async (req, res) => {
    try {
        const [dbUsers] = await userDb.execute('SELECT clerk_user_id, first_name, last_name, phone_number, gender, birth_date, address, id_picture_url, created_at FROM users');

        // Fetch full user details from Clerk for each user
        const userPromises = dbUsers.map(async (dbUser) => {
            try {
                const clerkUser = await clerkClient.users.getUser(dbUser.clerk_user_id);
                // Combine DB data with Clerk data
                return {
                    id: dbUser.clerk_user_id,
                    firstName: clerkUser.firstName || dbUser.first_name,
                    lastName: clerkUser.lastName || dbUser.last_name,
                    email: clerkUser.emailAddresses.find(ea => ea.id === clerkUser.primaryEmailAddressId)?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || 'N/A',
                    phone_number: dbUser.phone_number,
                    gender: dbUser.gender,
                    birthDate: dbUser.birth_date,
                    address: dbUser.address,
                    idPictureUrl: dbUser.id_picture_url,
                    createdAt: dbUser.created_at,
                    // Add other Clerk-specific fields if needed, e.g.,
                    lastSignInAt: clerkUser.lastSignInAt,
                    publicMetadata: clerkUser.publicMetadata
                };
            } catch (clerkError) {
                console.warn(`Could not fetch Clerk details for user ${dbUser.clerk_user_id}:`, clerkError.message);
                // Fallback to only DB data if Clerk fetch fails
                return {
                    id: dbUser.clerk_user_id,
                    firstName: dbUser.first_name,
                    lastName: dbUser.last_name,
                    email: 'Clerk data unavailable',
                    gender: dbUser.gender,
                    birthDate: dbUser.birth_date,
                    address: dbUser.address,
                    createdAt: dbUser.created_at
                };
            }
        });

        const users = await Promise.all(userPromises);
        res.json(users);
    } catch (error) {
        console.error("Error fetching users for admin dashboard:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /admin/rooms
app.get('/admin/rooms', verifyClerkToken, requireAdmin, async (req, res) => {
    try {
        const [results] = await roomDb.execute('SELECT * FROM rooms ORDER BY id DESC');
        const rooms = results.map(room => {
            const parsedImages = safeParseJSON(room.images, []);
            const parsedAmenities = safeParseJSON(room.amenities, []);
            const parsedOwner = safeParseJSON(room.owner, {});

            return {
                ...room,
                amenities: parsedAmenities,
                images: parsedImages,
                owner: parsedOwner,
                isAvailable: room.isAvailable === 1 // Convert tinyint(1) to boolean
            };
        });
        res.json(rooms);
    } catch (err) {
        console.error("Error getting all rooms for admin dashboard:", err);
        res.status(500).json({ error: err.message });
    }
});

//============================================================================================================================
//================= ADMIN BOOKINGS ==========================================================
//==========================================================================================================================


app.get('/admin/bookings', verifyClerkToken, requireAdmin, async (req, res) => { // Added requireAdmin
    console.log("[SERVER] Received request for ALL admin bookings.");
    try {
        const [bookings] = await bookingDb.query(
            `SELECT
                b.id,
                b.userId,
                b.roomId,
                b.checkInDate,
                b.checkOutDate,
                b.totalPrice,
                b.isPaid,
                b.amountPaid,
                b.guests,
                b.status,
                b.rejection_reason,
                b.physical_room_id,
                b.assigned_room_number,
                b.early_check_in_fee,
                b.lateCheckOutFee,
                b.actual_check_in_time,
                b.actual_check_out_time,
                b.actualPaymentTime,
                b.payment_reference,
                pr.room_number AS physical_room_number_from_pr
            FROM
                bookings b
            LEFT JOIN
                room_management_db.physical_rooms pr ON b.physical_room_id = pr.id
            ORDER BY
                b.id DESC`
        );

        if (bookings.length === 0) {
            return res.json({ totalBookings: 0, totalRevenue: 0, bookings: [] });
        }

        const roomIds = [...new Set(bookings.map(booking => booking.roomId))];
        const userIds = [...new Set(bookings.map(booking => booking.userId))];

        let rooms = [];
        if (roomIds.length > 0) {
            const roomIdsPlaceholder = roomIds.map(() => '?').join(',');
            const [fetchedRooms] = await roomDb.execute(
                `SELECT id, roomType, pricePerNight, images, amenities, owner
                 FROM rooms
                 WHERE id IN (${roomIdsPlaceholder})`,
                roomIds
            );
            rooms = fetchedRooms;
        }

        const roomsMap = new Map(rooms.map(room => {
            const parsedImages = safeParseJSON(room.images, []);
            const parsedAmenities = safeParseJSON(room.amenities, []);
            const parsedOwner = safeParseJSON(room.owner, {});
            const roomAddress = parsedOwner.address || 'Main Road 123 Street, 23 Colony';
            return [room.id, {
                id: room.id,
                roomType: room.roomType,
                pricePerNight: room.pricePerNight,
                images: parsedImages,
                amenities: parsedAmenities,
                owner: parsedOwner,
                address: roomAddress
            }];
        }));

        // Fetch user details including phone_number
        const usersMap = new Map();
        if (userIds.length > 0) {
            const userIdsPlaceholder = userIds.map(() => '?').join(',');
            const [fetchedUsers] = await userDb.execute(
                `SELECT clerk_user_id, first_name, last_name, phone_number
                 FROM users
                 WHERE clerk_user_id IN (${userIdsPlaceholder})`,
                userIds
            );
            fetchedUsers.forEach(user => {
                usersMap.set(user.clerk_user_id, user);
            });
        }
                // Fetch Clerk emails
        const userDetailsMap = new Map();
        if (userIds.length > 0) {
            const userPromises = userIds.map(async (id) => {
                try {
                    const user = await clerkClient.users.getUser(id);
                    return { id, userDetails: user };
                } catch (err) {
                    console.warn(`Failed to fetch Clerk user for ${id}:`, err.message);
                    return { id, userDetails: null };
                }
            });

            const results = await Promise.allSettled(userPromises);
            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value.userDetails) {
                    userDetailsMap.set(result.value.id, result.value.userDetails);
                }
            });
        }


        let totalRevenue = 0;
        const totalApprovedPaidBookings = bookings.filter(b => b.status === 'approved' && b.isPaid === 1);
        totalRevenue = totalApprovedPaidBookings.reduce((sum, b) => {
            const price = parseFloat(b.totalPrice);
            return sum + (isNaN(price) ? 0 : price);
        }, 0);

        const processedBookings = bookings.map(booking => {
    const roomDetails = roomsMap.get(booking.roomId);
    const dbUser = usersMap.get(booking.userId);           // from your internal DB
    const clerkUser = userDetailsMap.get(booking.userId);  // from Clerk

    const now = new Date();
    const checkOutDateObj = new Date(booking.checkOutDate);
    checkOutDateObj.setHours(12, 0, 0, 0);
    const timeDiff = checkOutDateObj.getTime() - now.getTime();
    const hoursRemaining = timeDiff / (1000 * 60 * 60);

    const numberOfNights = differenceInDays(checkOutDateObj, new Date(booking.checkInDate));

    let isApproachingCheckout = false;
    let isOverdue = false;
    if (booking.status === 'approved' || booking.status === 'checked_in') {
        if (hoursRemaining <= 24 && hoursRemaining > 0) {
            isApproachingCheckout = true;
        } else if (hoursRemaining <= 0) {
            isOverdue = true;
        }
    }

    const email =
        clerkUser?.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ||
        clerkUser?.emailAddresses[0]?.emailAddress || 'N/A';
        
    const parsedTotalPrice = parseFloat(booking.totalPrice);
    const parsedAmountPaid = parseFloat(booking.amountPaid || 0);
    let paymentStatus = 'Not Paid';
    if (!isNaN(parsedAmountPaid)) {
        if (parsedAmountPaid >= parsedTotalPrice) {
            paymentStatus = 'Fully Paid';
        } else if (parsedAmountPaid > 0) {
            paymentStatus = 'Partial';
        }
    }


    return {
        id: booking.id,
        userId: booking.userId,
        user: {
            id: dbUser?.clerk_user_id || booking.userId,
            firstName: dbUser?.first_name || 'N/A',
            lastName: dbUser?.last_name || 'N/A',
            phone_number: dbUser?.phone_number || 'N/A',
            email: email
        },
        nights: numberOfNights,
        room: {
            id: roomDetails?.id || null,
            roomType: roomDetails?.roomType || 'Unknown Room',
            address: roomDetails?.address || 'N/A',
            images: roomDetails?.images || [],
            amenities: roomDetails?.amenities || [],
            pricePerNight: roomDetails?.pricePerNight || 0
        },
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        totalPrice: parsedTotalPrice,
        isPaid: paymentStatus === 'Fully Paid',
        paymentStatus,
        amountPaid: parsedAmountPaid,
        guests: booking.guests,
        status: booking.status,
        rejection_reason: booking.rejection_reason,
        physicalRoomId: booking.physical_room_id,
        assignedRoomNumber: booking.assigned_room_number,
        physicalRoomNumber: booking.physical_room_number_from_pr,
        earlyCheckInFee: parseFloat(booking.early_check_in_fee || 0),
        lateCheckOutFee: parseFloat(booking.lateCheckOutFee || 0),
        actualCheckInTime: booking.actual_check_in_time,
        actualCheckOutTime: booking.actual_check_out_time,
        actualPaymentTime: booking.actualPaymentTime,
        paymentReference: booking.payment_reference || null,
        isApproachingCheckout,
        isOverdue
    };
});


        res.json({
            totalBookings: bookings.length,
            totalRevenue: totalRevenue.toFixed(2),
            bookings: processedBookings
        });

    } catch (err) {
        console.error("[SERVER] Error fetching all bookings for admin dashboard:", err);
        res.status(500).json({ error: err.message || 'Failed to fetch admin dashboard data' });
    }
});


// Route to approve a booking
app.patch('/admin/bookings/:id/approve', verifyClerkToken, requireAdmin, async (req, res) => {
    console.log(`[SERVER] Received request to APPROVE booking ID: ${req.params.id}`);
    const bookingId = req.params.id;
    const { physicalRoomId, assignedRoomNumber } = req.body; // NEW: Expect physicalRoomId and assignedRoomNumber

    if (!physicalRoomId || !assignedRoomNumber) {
        return res.status(400).json({ error: 'Physical Room ID and assigned Room Number are required for approval.' });
    }

    let booking;
    try {
        // 1. Fetch booking details to get userId, roomId, and other necessary info
        const [bookingRows] = await bookingDb.execute(
            `SELECT userId, roomId, checkInDate, checkOutDate, totalPrice, guests, early_check_in_fee FROM bookings WHERE id = ?`,
            [bookingId]
        );

        if (bookingRows.length === 0) {
            return res.status(404).json({ error: 'Booking not found.' });
        }
        booking = bookingRows[0];

        // 2. Check if the selected physical room is available and matches the room type
        const [physicalRoomCheck] = await roomDb.execute(
            `SELECT pr.id, pr.room_number, pr.status, pr.room_type_id, r.roomType
             FROM physical_rooms pr
             JOIN rooms r ON pr.room_type_id = r.id
             WHERE pr.id = ? AND pr.room_type_id = ? AND pr.status = 'available'`,
            [physicalRoomId, booking.roomId]
        );

        if (physicalRoomCheck.length === 0) {
            return res.status(400).json({ error: 'Selected physical room is not available or does not match the room type.' });
        }

        // 3. Update booking status and assign physical room
        const [result] = await bookingDb.execute(
            `UPDATE bookings SET status = 'approved', physical_room_id = ?, assigned_room_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [physicalRoomId, assignedRoomNumber, bookingId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Booking not found or already approved.' });
        }

        // 4. Mark the physical room as 'occupied'
        await roomDb.execute(
            `UPDATE physical_rooms SET status = 'occupied', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [physicalRoomId]
        );

        // 5. Fetch user details from Clerk to get their email
        let userEmail = 'N/A';
        try {
            const clerkUser = await clerkClient.users.getUser(booking.userId);
            userEmail = clerkUser.emailAddresses.find(ea => ea.id === clerkUser.primaryEmailAddressId)?.emailAddress ||
                        clerkUser.emailAddresses[0]?.emailAddress || 'N/A';
        } catch (clerkErr) {
            console.error(`[SERVER] Could not fetch Clerk user details for email for userId ${booking.userId}:`, clerkErr.message);
        }

        // 6. Fetch room details to include in the email
        let roomDetails = {};
        try {
            const [roomRows] = await roomDb.execute(
                `SELECT roomType, pricePerNight FROM rooms WHERE id = ?`,
                [booking.roomId]
            );
            if (roomRows.length > 0) {
                roomDetails = roomRows[0];
            }
        } catch (roomErr) {
            console.error(`[SERVER] Could not fetch room details for roomId ${booking.roomId}:`, roomErr.message);
        }

        // 7. Send email confirmation (only if user email is available)
        if (userEmail !== 'N/A' && process.env.EMAIL_FROM && process.env.EMAIL_SERVICE_USER) {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: userEmail,
                subject: `Your Booking #${bookingId} has been Approved!`,
                html: `
                    <p>Dear user,</p>
                    <p>Good news! Your booking request (ID: <strong>#${bookingId}</strong>) has been <strong>approved</strong>.</p>
                    <p>Here are your booking details:</p>
                    <ul>
                        <li><strong>Room Type:</strong> ${roomDetails.roomType || 'N/A'}</li>
                        <li><strong>Assigned Room Number:</strong> ${assignedRoomNumber}</li> <li><strong>Check-in Date:</strong> ${new Date(booking.checkInDate).toLocaleDateString()} at 2:00 PM</li>
                        <li><strong>Check-out Date:</strong> ${new Date(booking.checkOutDate).toLocaleDateString()} at 12:00 PM</li>
                        <li><strong>Number of Guests:</strong> ${booking.guests}</li>
                        <li><strong>Total Price:</strong> ₱${parseFloat(booking.totalPrice).toFixed(2)}</li>
                        ${booking.early_check_in_fee > 0 ? `<li><strong>Early Check-in Fee:</strong> ₱${parseFloat(booking.early_check_in_fee).toFixed(2)}</li>` : ''}
                    </ul>
                    <p>We look forward to welcoming you!</p>
                    <p>If you have any questions, please feel free to contact us.</p>
                    <p>Sincerely,</p>
                    <p>The ${process.env.EMAIL_FROM.split('<')[0].trim()} Team</p>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending approval email:', error);
                } else {
                    console.log('Approval email sent:', info.response);
                }
            });
        } else {
            console.warn(`[SERVER] Approval email not sent for booking ${bookingId}. Missing user email or email service config.`);
        }

        res.json({ message: 'Booking approved successfully and user notified!' });

        // --- NEW: Emit real-time update after booking approval ---
        emitRealtimeUpdate('bookingApproved', {
            id: bookingId,
            userId: booking.userId,
            roomId: booking.roomId,
            checkInDate: booking.checkInDate,
            checkOutDate: booking.checkOutDate,
            totalPrice: parseFloat(booking.totalPrice),
            guests: booking.guests,
            isPaid: booking.isPaid === 1,
            status: 'approved',
            physicalRoomId: physicalRoomId,
            assignedRoomNumber: assignedRoomNumber,
            earlyCheckInFee: parseFloat(booking.early_check_in_fee || 0),
            updatedAt: new Date().toISOString()
        });
        // --- END NEW ---


    } catch (err) {
        console.error("[SERVER] Error approving booking:", err);
        res.status(500).json({ error: err.message || 'Failed to approve booking' });
    }
});

// Route to reject a booking
app.patch('/admin/bookings/:id/reject', verifyClerkToken, requireAdmin, async (req, res) => {
    console.log(`[SERVER] Received request to REJECT booking ID: ${req.params.id}`);
    const bookingId = req.params.id;
    const { rejectionReason } = req.body; // Expecting rejectionReason from the frontend

    if (!rejectionReason || rejectionReason.trim() === '') {
        return res.status(400).json({ error: 'Rejection reason is required.' });
    }

    let booking;
    try {
        // 1. Fetch booking details to get userId and roomId
        const [bookingRows] = await bookingDb.execute(
            `SELECT userId, roomId, checkInDate, checkOutDate, totalPrice, physical_room_id, assigned_room_number, early_check_in_fee FROM bookings WHERE id = ?`,
            [bookingId]
        );

        if (bookingRows.length === 0) {
            return res.status(404).json({ error: 'Booking not found.' });
        }
        booking = bookingRows[0];

        // 2. Update booking status and store rejection reason
        const [result] = await bookingDb.execute(
            `UPDATE bookings SET status = 'rejected', rejection_reason = ?, physical_room_id = NULL, assigned_room_number = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [rejectionReason, bookingId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Booking not found or could not be rejected.' });
        }

        // 3. If a physical room was assigned, mark it as 'available' again
        if (booking.physical_room_id) {
            await roomDb.execute(
                `UPDATE physical_rooms SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [booking.physical_room_id]
            );
            console.log(`[SERVER] Physical room ${booking.assigned_room_number} (ID: ${booking.physical_room_id}) marked as available due to booking rejection.`);
        }

        // 4. Fetch user details from Clerk to get their email
        let userEmail = 'N/A';
        try {
            const clerkUser = await clerkClient.users.getUser(booking.userId);
            userEmail = clerkUser.emailAddresses.find(ea => ea.id === clerkUser.primaryEmailAddressId)?.emailAddress ||
                        clerkUser.emailAddresses[0]?.emailAddress || 'N/A';
        } catch (clerkErr) {
            console.error(`[SERVER] Could not fetch Clerk user details for email for userId ${booking.userId}:`, clerkErr.message);
        }

        // 5. Fetch room details to include in the email
        let roomDetails = {};
        try {
            const [roomRows] = await roomDb.execute(
                `SELECT roomType FROM rooms WHERE id = ?`,
                [booking.roomId]
            );
            if (roomRows.length > 0) {
                roomDetails = roomRows[0];
            }
        } catch (roomErr) {
            console.error(`[SERVER] Could not fetch room details for roomId ${booking.roomId}:`, roomErr.message);
        }

        // 6. Send email notification (only if user email is available)
        if (userEmail !== 'N/A' && process.env.EMAIL_FROM && process.env.EMAIL_SERVICE_USER) {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: userEmail,
                subject: `Your Booking #${bookingId} has been Rejected`,
                html: `
                    <p>Dear user,</p>
                    <p>We regret to inform you that your booking request (ID: <strong>#${bookingId}</strong>) has been rejected.</p>
                    <p><strong>Room Type:</strong> ${roomDetails.roomType || 'N/A'}</p>
                    ${booking.assigned_room_number ? `<p><strong>Previously Assigned Room Number:</strong> ${booking.assigned_room_number}</p>` : ''}
                    <p><strong>Check-in Date:</strong> ${new Date(booking.checkInDate).toLocaleDateString()}</p>
                    <p><strong>Check-out Date:</strong> ${new Date(booking.checkOutDate).toLocaleDateString()}</p>
                    <p><strong>Total Price:</strong> ₱${parseFloat(booking.totalPrice).toFixed(2)}</p>
                    ${booking.early_check_in_fee > 0 ? `<li><strong>Early Check-in Fee:</strong> ₱${parseFloat(booking.early_check_in_fee).toFixed(2)}</li>` : ''}
                    <p><strong>Reason for rejection:</strong></p>
                    <p style="padding: 10px; border: 1px solid #ccc; background-color: #f9f9f9;">${rejectionReason}</p>
                    <p>If you have any questions, please contact our support.</p>
                    <p>Thank you for your understanding.</p>
                    <p>Sincerely,</p>
                    <p>The ${process.env.EMAIL_FROM.split('<')[0].trim()} Team</p>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending rejection email:', error);
                } else {
                    console.log('Rejection email sent:', info.response);
                }
            });
        } else {
            console.warn(`[SERVER] Email not sent for booking ${bookingId}. Missing user email or email service config.`);
        }

        res.json({ message: 'Booking rejected successfully and user notified!' });

        // ---Emit real-time update after booking rejection ---
        emitRealtimeUpdate('bookingRejected', {
            id: bookingId,
            userId: booking.userId,
            roomId: booking.roomId,
            checkInDate: booking.checkInDate,
            checkOutDate: booking.checkOutDate,
            totalPrice: parseFloat(booking.totalPrice),
            guests: booking.guests,
            isPaid: booking.isPaid === 1,
            status: 'rejected', // The new status
            rejectionReason: rejectionReason, // Include the reason
            physicalRoomId: null, // Clear physical room assignment
            assignedRoomNumber: null, // Clear assigned room number
            earlyCheckInFee: parseFloat(booking.early_check_in_fee || 0),
            updatedAt: new Date().toISOString()
        });
        // --- END NEW ---

    } catch (err) {
        console.error("[SERVER] Error rejecting booking:", err);
        res.status(500).json({ error: err.message || 'Failed to reject booking' });
    }
});


//=============================================================================================================================
//============================    CHECK OUT FOR ADMIN   =================================================================
//=============================================================================================================================
// NEW: Endpoint to mark a booking as checked out (admin only)
app.patch('/admin/bookings/:id/checkout', verifyClerkToken, requireAdmin, async (req, res) => {
    const bookingId = req.params.id;
    const actualCheckOutTime = new Date(); // Use current time for actual checkout

    try {
        // Fetch booking details including physical_room_id, status, checkOutDate, and totalPrice
        const [bookingRows] = await bookingDb.execute(
            `SELECT physical_room_id, status, checkOutDate, totalPrice FROM bookings WHERE id = ?`,
            [bookingId]
        );

        if (bookingRows.length === 0) {
            return res.status(404).json({ error: 'Booking not found.' });
        }
        const booking = bookingRows[0];

        if (booking.status !== 'approved') {
            return res.status(400).json({ error: `Booking status is '${booking.status}'. Only 'approved' bookings can be checked out.` });
        }

        let lateCheckOutFee = 0;
        const scheduledCheckOutDate = new Date(booking.checkOutDate);
        // Assuming standard checkout time is 12:00 PM (noon)
        scheduledCheckOutDate.setHours(12, 0, 0, 0);

        // Calculate late check-out fee if actualCheckOutTime is after scheduledCheckOutDate
        if (isAfter(actualCheckOutTime, scheduledCheckOutDate)) {
            // Calculate difference in hours, rounding up to the nearest full hour
            const lateHours = differenceInHours(actualCheckOutTime, scheduledCheckOutDate);
            // Ensure a minimum of 1 hour is charged if even slightly late
            lateCheckOutFee = Math.ceil(lateHours) * 100; // ₱100 per hour
            console.log(`[SERVER] Late Check-out detected for booking ${bookingId}: ${lateHours} hours late. Fee: ₱${lateCheckOutFee}`);
        }

        const newTotalPrice = parseFloat(booking.totalPrice) + lateCheckOutFee;

        const [result] = await bookingDb.execute(
            `UPDATE bookings SET status = 'checked_out', actual_check_out_time = ?, lateCheckOutFee = ?, totalPrice = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [actualCheckOutTime, lateCheckOutFee, newTotalPrice, bookingId]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({ error: 'Failed to update booking status to checked_out.' });
        }

        // If a physical room was assigned, mark it as 'available'
        if (booking.physical_room_id) {
            await roomDb.execute(
                `UPDATE physical_rooms SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [booking.physical_room_id]
            );
            console.log(`[SERVER] Physical room (ID: ${booking.physical_room_id}) marked as available due to booking checkout.`);
        }

        res.json({
            message: `Booking ${bookingId} marked as checked out.`,
            lateCheckOutFee: lateCheckOutFee,
            newTotalPrice: newTotalPrice
        });

        // Emit real-time update with the new lateCheckOutFee and updated total price
        emitRealtimeUpdate('bookingCheckedOut', {
            id: bookingId,
            status: 'checked_out',
            actualCheckOutTime: actualCheckOutTime.toISOString(),
            physicalRoomId: booking.physical_room_id,
            lateCheckOutFee: lateCheckOutFee, // Include the new fee
            totalPrice: newTotalPrice, // Include the updated total price
            updatedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error(`Error checking out booking ${bookingId}:`, err);
        res.status(500).json({ error: err.message || 'Failed to check out booking' });
    }
});

// NEW: Endpoint to extend a booking (admin only)
app.patch('/admin/bookings/:id/extend', verifyClerkToken, requireAdmin, async (req, res) => {
    const bookingId = req.params.id;
    const { newCheckOutDate } = req.body; // Expect new check-out date from admin

    if (!newCheckOutDate) {
        return res.status(400).json({ error: 'New check-out date is required for extension.' });
    }

    try {
        const [bookingRows] = await bookingDb.execute(
            `SELECT b.roomId, b.checkInDate, b.checkOutDate, b.totalPrice, r.pricePerNight
             FROM bookings b
             JOIN room_management_db.rooms r ON b.roomId = r.id
             WHERE b.id = ? AND b.status = 'approved'`, // Only extend approved bookings
            [bookingId]
        );

        if (bookingRows.length === 0) {
            return res.status(404).json({ error: 'Approved booking not found or cannot be extended.' });
        }
        const booking = bookingRows[0];

        const oldCheckOut = new Date(booking.checkOutDate);
        const newCheckOut = new Date(newCheckOutDate);

        // Ensure new check-out date is after the old one
        if (newCheckOut <= oldCheckOut) {
            return res.status(400).json({ error: 'New check-out date must be after the current check-out date.' });
        }

        // Calculate additional nights and new total price
        const timeDiff = newCheckOut.getTime() - oldCheckOut.getTime();
        const daysExtended = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // Round up to full days

        const additionalPrice = daysExtended * parseFloat(booking.pricePerNight);
        const newTotalPrice = parseFloat(booking.totalPrice) + additionalPrice;

        const [result] = await bookingDb.execute(
            `UPDATE bookings SET checkOutDate = ?, totalPrice = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [newCheckOut.toISOString().split('T')[0], newTotalPrice, bookingId]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({ error: 'Failed to update booking for extension.' });
        }

        res.json({ message: `Booking ${bookingId} extended successfully by ${daysExtended} days.`, newTotalPrice: newTotalPrice.toFixed(2) });

        emitRealtimeUpdate('bookingExtended', {
            id: bookingId,
            newCheckOutDate: newCheckOut.toISOString().split('T')[0],
            newTotalPrice: newTotalPrice.toFixed(2),
            updatedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error(`Error extending booking ${bookingId}:`, err);
        res.status(500).json({ error: err.message || 'Failed to extend booking' });
    }
});

//================================================================================================================
//================================================================================================================

                                    //HISTORY HISTORY HISTORY

//================================================================================================================
//================================================================================================================

// NEW: API route to fetch checked-out bookings for history
// NEW: API route to fetch checked-out bookings for history
app.get('/admin/checked-out-bookings', verifyClerkToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', type = 'all' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        let onlineBookings = [];
        let walkInBookings = [];
        let totalDocs = 0;

        // Fetch Online Bookings
        if (type === 'all' || type === 'online') {
            const baseQueryOnline = `b.status = 'checked_out'`;
            const searchSqlOnline = search
                ? `AND (u.first_name LIKE ? OR u.last_name LIKE ? OR r.roomType LIKE ?)`
                : '';
            const searchParamsOnline = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

            const [onlineResults] = await bookingDb.query(
                `SELECT
                    b.id, b.userId, b.roomId, b.checkInDate, b.checkOutDate, b.totalPrice, b.physical_room_id AS physicalRoomId,
                    b.isPaid, -- Removed amountPaid, lateCheckOutFee, earlyCheckInFee, discount_type, discount_amount for online bookings
                    b.guests, -- Removed b.nights from here as it doesn't exist in booking_db.bookings
                    b.actual_check_in_time, b.actual_check_out_time,   
                    u.first_name, u.last_name, u.email, u.phone_number, u.id_picture_url AS idPictureUrl,
                    r.roomType, r.pricePerNight AS roomPrice, -- Added roomPrice for online bookings
                    pr.room_number AS physicalRoomNumber
                FROM bookings b
                LEFT JOIN user_db.users u ON b.userId = u.clerk_user_id
                LEFT JOIN room_management_db.rooms r ON b.roomId = r.id
                LEFT JOIN room_management_db.physical_rooms pr ON b.physical_room_id = pr.id
                WHERE ${baseQueryOnline} ${searchSqlOnline}
                ORDER BY b.checkOutDate DESC
                LIMIT ? OFFSET ?`,
                [...searchParamsOnline, limitNum, offset]
            );

            const [totalOnlineCount] = await bookingDb.query(
                `SELECT COUNT(b.id) AS count
                FROM bookings b
                LEFT JOIN user_db.users u ON b.userId = u.clerk_user_id
                LEFT JOIN room_management_db.rooms r ON b.roomId = r.id
                LEFT JOIN room_management_db.physical_rooms pr ON b.physical_room_id = pr.id
                WHERE ${baseQueryOnline} ${searchSqlOnline}`,
                searchParamsOnline
            );
            totalDocs += totalOnlineCount[0].count;

            onlineBookings = onlineResults.map(row => ({
                id: row.id,
                userId: row.userId,
                roomId: row.roomId,
                checkInDate: row.checkInDate,
                checkOutDate: row.checkOutDate,
                actual_check_in_time: row.actual_check_in_time, // ADDED this
                actual_check_out_time: row.actual_check_out_time, // ADDED this
                totalPrice: row.totalPrice,
                physicalRoomId: row.physicalRoomId,
                isPaid: Boolean(row.isPaid),
        idPictureUrl: row.idPictureUrl,
                amountPaid: null, // Set to null or 0 for online bookings as it's not applicable
                lateCheckOutFee: null, // Set to null or 0
                earlyCheckInFee: null, // Set to null or 0
                discount_type: null, // Set to null
                discount_amount: null, // Set to null or 0
                guests: row.guests,
                // Nights will be computed on the frontend for online bookings
                nights: null, // Set to null here, will be computed on frontend
                firstName: row.first_name,
                lastName: row.last_name,
                email: row.email, // Mapped email
                phone: row.phone_number, // Mapped phone
                idPictureUrl: row.idPictureUrl, 
                roomType: row.roomType,
                roomPrice: row.roomPrice,
                physicalRoomNumber: row.physicalRoomNumber,
                status: 'checked_out', // Ensure status is set for online bookings
            }));
        }

        // Fetch Walk-In Bookings (with corrected aliases)
        if (type === 'all' || type === 'walk-in') {
            const baseQueryWalkIn = `wb.status = 'Checked-Out'`;
            const searchSqlWalkIn = search
                ? `AND (wb.firstName LIKE ? OR wb.lastName LIKE ? OR r.roomType LIKE ?)`
                : '';
            const searchParamsWalkIn = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

            const [walkInResults] = await walkInBookingDb.query(
                `SELECT
                    wb.id, wb.firstName, wb.lastName, wb.physicalRoomId,
                    wb.checkInDateAndTime AS checkInDate,
                    wb.checkOutDateAndTime AS checkOutDate,
                    wb.totalPrice, wb.amountPaid, wb.isPaid, wb.lateCheckOutFee, wb.earlyCheckInFee,
                    wb.discount_type, wb.discount_amount, wb.guests, wb.nights, -- Added nights for walk-in bookings
                    wb.email, wb.phone AS phone, wb.idPictureUrl AS idPictureUrl, -- Corrected wb.id_picture_url to wb.idPictureUrl
                    r.roomType, r.pricePerNight AS roomPrice,
                    pr.room_number AS physicalRoomNumber
                FROM bookings wb
                LEFT JOIN room_management_db.rooms r ON wb.roomTypeId = r.id
                LEFT JOIN room_management_db.physical_rooms pr ON wb.physicalRoomId = pr.id
                WHERE ${baseQueryWalkIn} ${searchSqlWalkIn}
                ORDER BY wb.checkOutDateAndTime DESC
                LIMIT ? OFFSET ?`,
                [...searchParamsWalkIn, limitNum, offset]
            );

            const [totalWalkInCount] = await walkInBookingDb.query(
                `SELECT COUNT(wb.id) AS count
                FROM bookings wb
                LEFT JOIN room_management_db.rooms r ON wb.roomTypeId = r.id
                LEFT JOIN room_management_db.physical_rooms pr ON wb.physicalRoomId = pr.id
                WHERE ${baseQueryWalkIn} ${searchSqlWalkIn}`,
                searchParamsWalkIn
            );
            totalDocs += totalWalkInCount[0].count;

            walkInBookings = walkInResults.map(row => ({
                id: row.id,
                firstName: row.firstName,
                lastName: row.lastName,
                physicalRoomId: row.physicalRoomId,
                checkInDate: row.checkInDate,
                checkOutDate: row.checkOutDate,
                totalPrice: row.totalPrice,
                amountPaid: row.amountPaid,
                isPaid: row.isPaid, // String for walk-in bookings ('Fully Paid', 'Partial', 'Not Paid')
                lateCheckOutFee: row.lateCheckOutFee,
                earlyCheckInFee: row.earlyCheckInFee,
                discount_type: row.discount_type,
                discount_amount: row.discount_amount,
                guests: row.guests,
                nights: row.nights, // Mapped nights
                email: row.email, // Mapped email
                phone: row.phone, // Mapped phone
                idPictureUrl: row.idPictureUrl,
                roomType: row.roomType,
                roomPrice: row.roomPrice,
                physicalRoomNumber: row.physicalRoomNumber,
                status: 'Checked-Out', // Ensure status is set for walk-in bookings
            }));
        }

        const combinedBookings = [...onlineBookings, ...walkInBookings];
        const sortedBookings = combinedBookings.sort((a, b) => new Date(b.checkOutDate) - new Date(a.checkOutDate));

        res.status(200).json({
            bookings: sortedBookings,
            totalPages: Math.ceil(totalDocs / limitNum),
            currentPage: pageNum,
            totalCount: totalDocs,
        });

    } catch (error) {
        console.error('Error fetching checked-out bookings:', error);
        res.status(500).json({ error: 'Failed to fetch booking history.' });
    }
});



server.listen(PORT, '0.0.0.0', () => { 
    console.log(`Server running on http://localhost:${PORT}`);
});