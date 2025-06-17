const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Database setup
const db = new sqlite3.Database('school.db');

// Initialize database tables
db.serialize(() => {
    // Users table (students and teachers/admin)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('student', 'teacher', 'admin')),
        class TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Materials table
    db.run(`CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        file_path TEXT,
        file_name TEXT,
        subject TEXT,
        class TEXT,
        uploaded_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users (id)
    )`);

    // Attendance table
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        date DATE,
        status TEXT CHECK(status IN ('present', 'absent', 'late')),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES users (id)
    )`);

    // Insert default admin user
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, password, name, role) 
            VALUES ('admin', ?, 'Administrator', 'admin')`, [adminPassword]);

    // Insert sample teacher
    const teacherPassword = bcrypt.hashSync('teacher123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, password, name, role) 
            VALUES ('guru1', ?, 'Bapak Andi Saputra', 'teacher')`, [teacherPassword]);

    // Insert sample students
    const studentPassword = bcrypt.hashSync('student123', 10);
    const students = [
        ['siswa1', 'Ahmad Rizki', 'Kelas 1'],
        ['siswa2', 'Siti Aminah', 'Kelas 1'],
        ['siswa3', 'Budi Santoso', 'Kelas 2'],
        ['siswa4', 'Dewi Sartika', 'Kelas 2'],
        ['siswa5', 'Fajar Nugraha', 'Kelas 3']
    ];

    students.forEach(([username, name, kelas]) => {
        db.run(`INSERT OR IGNORE INTO users (username, password, name, role, class) 
                VALUES (?, ?, ?, 'student', ?)`, [username, studentPassword, name, kelas]);
    });
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|ppt|pptx|mp4|avi|mov/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('File type not allowed'));
        }
    },
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                class: user.class
            }
        });
    });
});

// Get current user info
app.get('/api/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// Materials routes

// Get all materials
app.get('/api/materials', authenticateToken, (req, res) => {
    let query = `
        SELECT m.*, u.name as uploaded_by_name 
        FROM materials m 
        LEFT JOIN users u ON m.uploaded_by = u.id 
        ORDER BY m.created_at DESC
    `;
    
    db.all(query, [], (err, materials) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(materials);
    });
});

// Upload material (teachers/admin only)
app.post('/api/materials', authenticateToken, upload.single('file'), (req, res) => {
    if (req.user.role === 'student') {
        return res.status(403).json({ error: 'Access denied' });
    }

    const { title, description, subject, class: materialClass } = req.body;
    const file = req.file;

    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    const filePath = file ? file.path : null;
    const fileName = file ? file.originalname : null;

    db.run(
        'INSERT INTO materials (title, description, file_path, file_name, subject, class, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [title, description, filePath, fileName, subject, materialClass, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id: this.lastID, message: 'Material uploaded successfully' });
        }
    );
});

// Delete material (teachers/admin only)
app.delete('/api/materials/:id', authenticateToken, (req, res) => {
    if (req.user.role === 'student') {
        return res.status(403).json({ error: 'Access denied' });
    }

    const materialId = req.params.id;

    // Get file path before deleting
    db.get('SELECT file_path FROM materials WHERE id = ?', [materialId], (err, material) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (material && material.file_path) {
            // Delete file from filesystem
            fs.unlink(material.file_path, (err) => {
                if (err) console.log('Error deleting file:', err);
            });
        }

        // Delete from database
        db.run('DELETE FROM materials WHERE id = ?', [materialId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Material deleted successfully' });
        });
    });
});

// Attendance routes

// Submit attendance (students only)
app.post('/api/attendance', authenticateToken, (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Access denied' });
    }

    const { status, notes } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Check if already marked attendance today
    db.get(
        'SELECT * FROM attendance WHERE student_id = ? AND date = ?',
        [req.user.id, today],
        (err, existing) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (existing) {
                return res.status(400).json({ error: 'Attendance already marked for today' });
            }

            // Insert new attendance record
            db.run(
                'INSERT INTO attendance (student_id, date, status, notes) VALUES (?, ?, ?, ?)',
                [req.user.id, today, status || 'present', notes],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    res.json({ message: 'Attendance marked successfully' });
                }
            );
        }
    );
});

// Get attendance records
app.get('/api/attendance', authenticateToken, (req, res) => {
    let query, params;

    if (req.user.role === 'student') {
        // Students can only see their own attendance
        query = `
            SELECT a.*, u.name as student_name 
            FROM attendance a 
            LEFT JOIN users u ON a.student_id = u.id 
            WHERE a.student_id = ? 
            ORDER BY a.date DESC
        `;
        params = [req.user.id];
    } else {
        // Teachers/admin can see all attendance
        query = `
            SELECT a.*, u.name as student_name, u.class 
            FROM attendance a 
            LEFT JOIN users u ON a.student_id = u.id 
            ORDER BY a.date DESC, u.name
        `;
        params = [];
    }

    db.all(query, params, (err, attendance) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(attendance);
    });
});

// Get students list (teachers/admin only)
app.get('/api/students', authenticateToken, (req, res) => {
    if (req.user.role === 'student') {
        return res.status(403).json({ error: 'Access denied' });
    }

    db.all(
        'SELECT id, username, name, class FROM users WHERE role = "student" ORDER BY class, name',
        [],
        (err, students) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(students);
        }
    );
});

// Check today's attendance status
app.get('/api/attendance/today', authenticateToken, (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Access denied' });
    }

    const today = new Date().toISOString().split('T')[0];

    db.get(
        'SELECT * FROM attendance WHERE student_id = ? AND date = ?',
        [req.user.id, today],
        (err, attendance) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ hasAttendance: !!attendance, attendance });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});