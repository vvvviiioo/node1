const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));

let tasks = [];
let taskId = 1;

app.get('/', (req, res) => {
    let taskList = tasks.map(task => `
        <li>
            ${task.text}
            <form action="/delete-task/${task.id}" method="POST" style="display:inline;">
                <button type="submit">Удалить</button>
            </form>
        </li>
    `).join('');

    res.send(`
        <h1>Список задач</h1>
        <ul>${taskList}</ul>
        <form action="/add-task" method="POST">
            <input type="text" name="task" required placeholder="Новая задача">
            <button type="submit">Добавить задачу</button>
        </form>
    `);
});


app.post('/add-task', (req, res) => {
    const taskText = req.body.task;
    tasks.push({ id: taskId++, text: taskText });
    res.redirect('/');
});


app.post('/delete-task/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
        tasks.splice(taskIndex, 1);
    }
    res.redirect('/');
});




app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});