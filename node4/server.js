const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());
const PORT = 3000;


app.get('/api/message', (req, res) => {
    const currentTime = new Date().toLocaleTimeString();
    res.json({ 
        message: `Привет от сервера! Текущее время: ${currentTime}` 
    });
});


app.post('/api/echo', (req, res) => {
    const { text } = req.body;
    const currentTime = new Date().toLocaleTimeString();
    res.json({ 
        echo: `Вы отправили: "${text}". Время получения: ${currentTime}` 
    });
});


app.post('/api/calculate', (req, res) => {
    const { num1, num2, operation } = req.body;
    const currentTime = new Date().toLocaleTimeString();
    
    let result;
    let error = null;
    
    if (isNaN(num1) || isNaN(num2)) {
        error = "Оба параметра должны быть числами";
    } else {
        switch (operation) {
            case 'add':
                result = num1 + num2;
                break;
            case 'subtract':
                result = num1 - num2;
                break;
            case 'multiply':
                result = num1 * num2;
                break;
            case 'divide':
                if (num2 === 0) {
                    error = "Деление на ноль невозможно";
                } else {
                    result = num1 / num2;
                }
                break;
            default:
                error = "Неизвестная операция";
        }
    }
    
    if (error) {
        res.json({ error, time: currentTime });
    } else {
        res.json({ 
            result, 
            operation: getOperationName(operation),
            time: currentTime 
        });
    }
});


function getOperationName(operation) {
    const operations = {
        'add': 'сложение',
        'subtract': 'вычитание',
        'multiply': 'умножение',
        'divide': 'деление'
    };
    return operations[operation] || operation;
}

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});



app.use(express.static(path.join(__dirname, 'views')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});