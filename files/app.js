const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
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
    if (err) console.error('Ошибка создания таблицы:', err);
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

const upload = multer({ storage: storage });

app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/files', (req, res) => {
    res.sendFile(path.join(__dirname, 'files.html'));
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