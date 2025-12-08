const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

const uploadDir = path.join(__dirname, 'uploads');
const avatarsDir = path.join(__dirname, 'avatars');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
}

const db = new sqlite3.Database('files.db');

db.run(`
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER,
        type TEXT,
        upload_date TEXT
    )
`, (err) => {
    if (err) console.error('Ошибка создания таблицы files:', err);
});

db.run(`
    CREATE TABLE IF NOT EXISTS avatars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER,
        type TEXT,
        upload_date TEXT,
        is_active INTEGER DEFAULT 1
    )
`, (err) => {
    if (err) console.error('Ошибка создания таблицы avatars:', err);
});

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        const originalName = file.originalname;
        let filename = originalName;
        let counter = 1;
        
        while (fs.existsSync(path.join(uploadDir, filename))) {
            const ext = path.extname(originalName);
            const nameWithoutExt = path.basename(originalName, ext);
            filename = `${nameWithoutExt}(${counter})${ext}`;
            counter++;
        }
        
        cb(null, filename);
    }
});

const avatarStorage = multer.diskStorage({
    destination: avatarsDir,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `avatar_${Date.now()}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({ storage: storage });
const avatarUpload = multer({ 
    storage: avatarStorage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Разрешены только изображения (JPEG, PNG, GIF, WebP)'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});




app.post('/upload', upload.single('filedata'), (req, res) => {
    const file = req.file;
    
    if (!file) {
        return res.send(`
            <html>
                <head><title>Ошибка</title></head>
                <body>
                    <h1>Ошибка!</h1>
                    <p>Файл не был выбран</p>
                    <a href="/">Назад</a>
                </body>
            </html>
        `);
    }
    
    db.run(
        'INSERT INTO files (name, path, size, type, upload_date) VALUES (?, ?, ?, ?, ?)',
        [file.originalname, file.path, file.size, file.mimetype, new Date().toISOString()],
        function(err) {
            if (err) {
                console.error('Ошибка базы данных:', err);
                return res.send('Ошибка при сохранении в базу данных');
            }
            
            res.redirect('/files');
        }
    );
});

app.get('/api/files', (req, res) => {
    db.all('SELECT * FROM files ORDER BY upload_date DESC', (err, rows) => {
        if (err) {
            console.error(err);
            return res.json({ error: 'Ошибка базы данных' });
        }
        
        const files = rows.map(file => ({
            ...file,
            upload_date: new Date(file.upload_date).toLocaleString(),
            size_formatted: formatSize(file.size)
        }));
        
        res.json(files);
    });
});

app.get('/api/avatar', (req, res) => {
    db.get('SELECT * FROM avatars WHERE is_active = 1 ORDER BY upload_date DESC LIMIT 1', (err, avatar) => {
        if (err) {
            console.error(err);
            return res.json({ error: 'Ошибка базы данных', exists: false });
        }
        
        if (!avatar) {
            return res.json({ exists: false });
        }
        
        const avatarData = {
            ...avatar,
            exists: true,
            upload_date: new Date(avatar.upload_date).toLocaleString(),
            size_formatted: formatSize(avatar.size),
            url: `/avatar/file/${avatar.id}`
        };
        
        res.json(avatarData);
    });
});

app.post('/api/avatar', avatarUpload.single('avatar'), (req, res) => {
    const file = req.file;
    
    if (!file) {
        return res.status(400).json({ success: false, error: 'Файл не был выбран или превышен допустимый размер' });
    }
    
    db.run('UPDATE avatars SET is_active = 0 WHERE is_active = 1', [], (err) => {
        if (err) {
            console.error('Ошибка обновления аватарок:', err);
            return res.status(500).json({ success: false, error: 'Ошибка базы данных' });
        }
        
        db.run(
            'INSERT INTO avatars (filename, path, size, type, upload_date, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            [file.originalname, file.path, file.size, file.mimetype, new Date().toISOString(), 1],
            function(err) {
                if (err) {
                    console.error('Ошибка базы данных:', err);
                    return res.status(500).json({ success: false, error: 'Ошибка при сохранении аватарки' });
                }
                
                res.json({ 
                    success: true, 
                    id: this.lastID,
                    filename: file.originalname,
                    size: file.size,
                    type: file.mimetype
                });
            }
        );
    });
});

app.delete('/api/avatar', (req, res) => {
    db.get('SELECT * FROM avatars WHERE is_active = 1', (err, avatar) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, error: 'Ошибка базы данных' });
        }
        
        if (!avatar) {
            return res.json({ success: false, error: 'Аватарка не найдена' });
        }
        
        fs.unlink(avatar.path, (err) => {
            if (err) {
                console.error('Ошибка удаления файла аватарки:', err);
            }
            
            db.run('DELETE FROM avatars WHERE id = ?', [avatar.id], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, error: 'Ошибка базы данных' });
                }
                
                res.json({ success: true });
            });
        });
    });
});

app.get('/avatar/file/:id', (req, res) => {
    const id = req.params.id;
    
    db.get('SELECT * FROM avatars WHERE id = ?', [id], (err, avatar) => {
        if (err || !avatar) {
            return res.status(404).send('Аватарка не найдена');
        }
        
        if (!fs.existsSync(avatar.path)) {
            return res.status(404).send('Файл отсутствует на сервере');
        }
        
        res.sendFile(avatar.path);
    });
});

app.delete('/api/files/:id', (req, res) => {
    const id = req.params.id;
    
    db.get('SELECT * FROM files WHERE id = ?', [id], (err, file) => {
        if (err || !file) {
            return res.json({ success: false, error: 'Файл не найден' });
        }
        
        fs.unlink(file.path, (err) => {
            if (err) {
                console.error('Ошибка удаления файла:', err);
            }
            
            db.run('DELETE FROM files WHERE id = ?', [id], (err) => {
                if (err) {
                    return res.json({ success: false, error: 'Ошибка базы данных' });
                }
                
                res.json({ success: true });
            });
        });
    });
});

app.get('/download/:id', (req, res) => {
    const id = req.params.id;
    
    db.get('SELECT * FROM files WHERE id = ?', [id], (err, file) => {
        if (err || !file) {
            return res.status(404).send('Файл не найден');
        }
        
        if (!fs.existsSync(file.path)) {
            return res.status(404).send('Файл отсутствует на сервере');
        }
        
        res.download(file.path, file.name);
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});

function formatSize(bytes) {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


app.use(express.static(__dirname));
app.use("/styles", express.static(path.join(__dirname, "styles")));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/files', (req, res) => {
    res.sendFile(path.join(__dirname, 'files.html'));
});

app.get('/avatar', (req, res) => {
    res.sendFile(path.join(__dirname, 'avatar.html'));
});