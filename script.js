
const taskForm = document.querySelector("#taskForm");
const taskInput = document.querySelector("#taskInput");
const taskList = document.querySelector("#taskList");

const totalTasks = document.querySelector("#totalTasks");
const completedTasks = document.querySelector("#completedTasks");
const remainingTasks = document.querySelector("#remainingTasks");

// Pobieramy zapisane zadania lub tworzymy pustą tablicę.
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

// Zapisujemy zadania w przeglądarce.
function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

// Aktualizujemy statystyki.
function updateStats() {
    const completed = tasks.filter(task => task.completed).length;

    totalTasks.textContent = tasks.length;
    completedTasks.textContent = completed;
    remainingTasks.textContent = tasks.length - completed;
}

// Wyświetlamy zadania.
function renderTasks() {
    taskList.innerHTML = "";

    if (tasks.length === 0) {
        taskList.innerHTML =
            '<p class="empty-message">Nie masz jeszcze żadnych zadań.</p>';
    }

    tasks.forEach(task => {
        const item = document.createElement("div");

        item.className = "task-item";

        if (task.completed) {
            item.classList.add("completed");
        }

        const left = document.createElement("div");
        left.className = "task-left";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;

        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            saveTasks();
            renderTasks();
        });

        const title = document.createElement("span");
        title.className = "task-title";
        title.textContent = task.title;

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Usuń";

        deleteButton.addEventListener("click", () => {
            tasks = tasks.filter(t => t.id !== task.id);
            saveTasks();
            renderTasks();
        });

        left.append(checkbox, title);
        item.append(left, deleteButton);

        taskList.appendChild(item);
    });

    updateStats();
}

// Dodawanie nowych zadań.
taskForm.addEventListener("submit", event => {
    event.preventDefault();

    const title = taskInput.value.trim();

    if (title === "") {
        return;
    }

    const newTask = {
        id: crypto.randomUUID(),
        title: title,
        completed: false
    };

    tasks.push(newTask);

    saveTasks();
    renderTasks();

    taskInput.value = "";
});

// Pierwsze wyświetlenie aplikacji.
renderTasks();
