document.getElementById('getMessage').addEventListener('click', () => {
    fetch('/api/message')
        .then(response => response.json())
        .then(data => {
            const output = document.getElementById('output');
            output.innerText = data.message;
            output.className = 'output success';
        })
        .catch(error => {
            console.error('Ошибка:', error);
            const output = document.getElementById('output');
            output.innerText = 'Ошибка при получении сообщения';
            output.className = 'output error';
        });
});


document.getElementById('echoForm').addEventListener('submit', (event) => {
    event.preventDefault();
    
    const text = document.getElementById('inputText').value;
    
    fetch('/api/echo', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
    })
        .then(response => response.json())
        .then(data => {
            const echoOutput = document.getElementById('echoOutput');
            echoOutput.innerText = data.echo;
            echoOutput.className = 'output success';
        })
        .catch(error => {
            console.error('Ошибка:', error);
            const echoOutput = document.getElementById('echoOutput');
            echoOutput.innerText = 'Ошибка при отправке сообщения';
            echoOutput.className = 'output error';
        });
});


document.getElementById('calcForm').addEventListener('submit', (event) => {
    event.preventDefault();
    
    const num1 = parseFloat(document.getElementById('num1').value);
    const num2 = parseFloat(document.getElementById('num2').value);
    const operation = document.getElementById('operation').value;
    
    fetch('/api/calculate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ num1, num2, operation }),
    })
        .then(response => response.json())
        .then(data => {
            const calcOutput = document.getElementById('calcOutput');
            if (data.error) {
                calcOutput.innerText = `Ошибка: ${data.error}`;
                calcOutput.className = 'output error';
            } else {
                calcOutput.innerText = `Результат ${data.operation}: ${data.result}. Время вычисления: ${data.time}`;
                calcOutput.className = 'output success';
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            const calcOutput = document.getElementById('calcOutput');
            calcOutput.innerText = 'Ошибка при вычислении';
            calcOutput.className = 'output error';
        });
});