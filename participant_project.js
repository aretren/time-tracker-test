document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH GUARD & SETUP ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const usernameDisplay = document.getElementById('username-display');

    if (!loggedInUser) {
        window.location.href = 'login.html';
        return;
    }
    usernameDisplay.textContent = `Пользователь: ${loggedInUser}`;

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    if (!projectId) {
        alert('Project ID not found.');
        window.location.href = 'participant.html';
        return;
    }

    // --- FIREBASE SETUP ---
    const firebaseConfig = {
        apiKey: "AIzaSyD2AgCF39T8Zk_kDRF6M9IHiMRz6stp_HA",
        authDomain: "time-tracker-15d2b.firebaseapp.com",
        databaseURL: "https://time-tracker-15d2b-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "time-tracker-15d2b",
        storageBucket: "time-tracker-15d2b.appspot.com",
        messagingSenderId: "697777625968",
        appId: "1:697777625968:web:fdb1bb780b20051d0ccdb5",
        measurementId: "G-Y877PXDVTY"
    };
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    const projectRef = database.ref(`projects/${projectId}`);


    // --- DOM ELEMENTS ---
    const projectNameHeader = document.getElementById('project-name-header');
    const calendarContainer = document.getElementById('calendar-container');
    const trainingListEl = document.getElementById('training-list');
    const materialsWidget = document.getElementById('materials-widget');

    // --- MODAL & MENU ELEMENTS ---
    const imageViewerModal = document.getElementById('image-viewer-modal');
    const closeImageViewerBtn = document.getElementById('close-image-viewer-btn');
    const imageViewerContent = document.getElementById('image-viewer-content');
    const addMaterialMenu = document.getElementById('add-material-menu');

    let calendar;
    let currentProject = {}; // To store project data

    // --- PERMISSIONS ---
    // On this page, the user can always edit their own materials.
    const canEditMaterials = true;

    // --- MATERIALS LOGIC (Adapted from project.js) ---
    const API_KEY = 'chv_v7pN_404b0e793451e27b444d3e9ee4e354c35359fbb9d4b8a70342659b3d9842d553c3a516066c6a2b31ddb892e00425dc8e08d1ecd26e579f55773ee79ab369f521';

    const getMaterialInfoFromElement = (element) => {
        const item = element.closest('.material-item');
        if (!item) return null;
        const username = loggedInUser; // Always the current user
        const materialType = item.dataset.type;
        const itemId = item.dataset.id;
        return { username, materialType, itemId, itemEl: item };
    };

    if (materialsWidget) {
        materialsWidget.addEventListener('click', async (e) => {
            const target = e.target;

            if (target.classList.contains('add-material-btn')) {
                showAddMaterialMenu(loggedInUser, target);
                return;
            }
            if (target.classList.contains('add-photo-btn')) {
                target.closest('.material-item').querySelector('.add-photo-input').click();
                return;
            }
            if (target.closest('.photo-thumbnail') && !target.classList.contains('delete-photo-btn')) {
                const imgSrc = target.closest('img').src;
                if (imgSrc) {
                    imageViewerContent.src = imgSrc;
                    imageViewerModal.classList.add('visible');
                }
                return;
            }
            if (target.classList.contains('delete-photo-btn')) {
                const info = getMaterialInfoFromElement(target);
                const photoId = target.closest('.photo-thumbnail').dataset.photoid;
                if (info && photoId && confirm('Удалить это фото?')) {
                    projectRef.child('materials').child(info.username).child(info.materialType).child(info.itemId).child('photos').child(photoId).remove();
                }
                return;
            }
            if (target.classList.contains('toggle-task-status-btn')) {
                const info = getMaterialInfoFromElement(target);
                if (info) {
                    const currentStatus = info.itemEl.classList.contains('completed') ? 'completed' : 'incomplete';
                    const newStatus = currentStatus === 'completed' ? 'incomplete' : 'completed';
                    projectRef.child('materials').child(info.username).child('tasks').child(info.itemId).child('status').set(newStatus);
                }
                return;
            }
            if (target.classList.contains('delete-material-btn')) {
                const info = getMaterialInfoFromElement(target);
                if (info && confirm('Вы уверены, что хотите удалить этот элемент?')) {
                    projectRef.child('materials').child(info.username).child(info.materialType).child(info.itemId).remove();
                }
                return;
            }
            if (target.classList.contains('edit-material-btn')) {
                const info = getMaterialInfoFromElement(target);
                if (!info) return;
                const { username, materialType, itemId, itemEl } = info;
                const data = currentProject.materials?.[username]?.[materialType]?.[itemId];
                if (!data) return;
                switch (materialType) {
                    case 'parties': renderPartyForm(itemEl, username, itemId, data); break;
                    case 'costumes': renderCostumeForm(itemEl, username, itemId, data); break;
                    case 'tasks': renderTaskForm(itemEl, username, itemId, data); break;
                }
            }
        });

        materialsWidget.addEventListener('change', async (e) => {
            if (e.target.classList.contains('add-photo-input')) {
                const files = e.target.files;
                if (!files.length) return;
                const info = getMaterialInfoFromElement(e.target);
                if (!info) return;
                const photosRef = projectRef.child('materials').child(info.username).child(info.materialType).child(info.itemId).child('photos');
                for (const file of files) {
                    const imageUrl = await uploadImage(file);
                    if (imageUrl) photosRef.push().set(imageUrl);
                }
            }
        });
    }

    const uploadImage = async (file) => {
        const formData = new FormData();
        formData.append('source', file);
        formData.append('key', API_KEY); // Use key in form data to avoid CORS preflight
        try {
            const response = await fetch('https://radikal.cloud/api/1/upload', {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            if (result.status_code === 200 && result.image?.url) {
                return result.image.url;
            } else {
                throw new Error(result.error?.message || 'URL не найден в ответе API.');
            }
        } catch (error) {
            console.error('Ошибка загрузки изображения:', error);
            alert(`Ошибка загрузки изображения: ${error.message}`);
            return null;
        }
    };

    // --- CONTEXT MENU & MODAL HANDLING ---
    const showAddMaterialMenu = (username, buttonEl) => {
        const rect = buttonEl.getBoundingClientRect();
        addMaterialMenu.style.top = `${rect.bottom + window.scrollY}px`;
        addMaterialMenu.style.left = `${rect.left + window.scrollX - addMaterialMenu.offsetWidth + rect.width}px`;
        addMaterialMenu.dataset.username = username;
        addMaterialMenu.classList.remove('hidden');
    };

    if(addMaterialMenu) {
        addMaterialMenu.addEventListener('click', (e) => {
            if (e.target.classList.contains('context-menu-item')) {
                const type = e.target.dataset.type;
                const username = addMaterialMenu.dataset.username;
                const container = document.querySelector(`.material-items-container[data-username="${username}"]`);
                if (!container) return;
                const formContainer = document.createElement('div');
                container.prepend(formContainer);
                switch (type) {
                    case 'party': renderPartyForm(formContainer, username); break;
                    case 'costume': renderCostumeForm(formContainer, username); break;
                    case 'task': renderTaskForm(formContainer, username); break;
                }
            }
            addMaterialMenu.classList.add('hidden');
        });
    }

    if(closeImageViewerBtn) closeImageViewerBtn.addEventListener('click', () => imageViewerModal.classList.remove('visible'));

    window.addEventListener('click', (e) => {
        if (addMaterialMenu && !addMaterialMenu.classList.contains('hidden') && !e.target.classList.contains('add-material-btn')) {
            addMaterialMenu.classList.add('hidden');
        }
        if (e.target === imageViewerModal) {
            imageViewerModal.classList.remove('visible');
        }
    });

    // --- MATERIAL DATA RENDERING ---
    const renderMyMaterials = (materials = {}) => {
        if (!materialsWidget) return;
        const materialsContent = document.getElementById('materials-content');
        materialsContent.innerHTML = '';
        const myMaterials = materials[loggedInUser] || {};

        const userContainer = document.createElement('div');
        userContainer.className = 'material-user-container';
        userContainer.dataset.username = loggedInUser;

        userContainer.innerHTML = `
            <div class="material-user-header">
                <h3>Мои материалы</h3>
                <button class="add-material-btn" data-username="${loggedInUser}">+</button>
            </div>
            <div class="material-items-container" data-username="${loggedInUser}"></div>
        `;
        materialsContent.appendChild(userContainer);
        const itemsContainer = userContainer.querySelector('.material-items-container');

        const renderAllItems = (type, renderFunc) => {
            if (myMaterials[type]) {
                Object.entries(myMaterials[type]).forEach(([id, data]) => {
                    const itemContainer = document.createElement('div');
                    itemsContainer.appendChild(itemContainer);
                    renderFunc(itemContainer, loggedInUser, id, data);
                });
            }
        };

        renderAllItems('parties', renderPartyItem);
        renderAllItems('costumes', renderCostumeItem);
        renderAllItems('tasks', renderTaskItem);
    };

    const renderPartyItem = (container, username, partyId, partyData) => {
        const photosHTML = partyData.photos ? Object.entries(partyData.photos).map(([photoId, url]) => `
            <div class="photo-thumbnail" data-photoid="${photoId}"><img src="${url}" alt="Фото"><button class="delete-photo-btn">&times;</button></div>`).join('') : '';
        container.className = 'material-item';
        container.dataset.id = partyId;
        container.dataset.type = 'parties';
        container.innerHTML = `
            <div class="material-item-header">
                <h4>Партия: ${partyData.name}</h4>
                <div class="material-item-actions"><button class="edit-material-btn">Редактировать</button><button class="delete-material-btn">Удалить</button></div>
            </div>
            <p>${partyData.description || ''}</p>
            <div class="photo-gallery">${photosHTML}</div>
            <input type="file" class="add-photo-input" multiple accept="image/*" style="display:none;">
            <button class="add-photo-btn">Добавить фото</button>
        `;
    };

    const renderCostumeItem = (container, username, costumeId, costumeData) => {
        const photosHTML = costumeData.photos ? Object.entries(costumeData.photos).map(([photoId, url]) => `
            <div class="photo-thumbnail" data-photoid="${photoId}"><img src="${url}" alt="Фото"><button class="delete-photo-btn">&times;</button></div>`).join('') : '';
        container.className = 'material-item';
        container.dataset.id = costumeId;
        container.dataset.type = 'costumes';
        container.innerHTML = `
            <div class="material-item-header">
                <h4>Костюм: ${costumeData.name}</h4>
                <div class="material-item-actions"><button class="edit-material-btn">Редактировать</button><button class="delete-material-btn">Удалить</button></div>
            </div>
            <p>${costumeData.link ? `<a href="${costumeData.link}" target="_blank">Ссылка</a>` : ''}</p>
            <div class="photo-gallery">${photosHTML}</div>
            <input type="file" class="add-photo-input" multiple accept="image/*" style="display:none;">
            <button class="add-photo-btn">Добавить фото</button>
        `;
    };

    const renderTaskItem = (container, username, taskId, taskData) => {
        container.className = `material-item task-item ${taskData.status === 'completed' ? 'completed' : ''}`;
        container.dataset.id = taskId;
        container.dataset.type = 'tasks';
        container.innerHTML = `
            <div class="task-content">
                <div class="material-item-header">
                    <h4>Задача: ${taskData.name}</h4>
                    <div class="material-item-actions"><button class="edit-material-btn">Редактировать</button><button class="delete-material-btn">Удалить</button></div>
                </div>
                <p>${taskData.description}</p>
            </div>
            <button class="toggle-task-status-btn">${taskData.status === 'completed' ? 'Не выполнено' : 'Выполнено'}</button>
        `;
    };

    // --- MATERIAL FORM RENDERING ---
    const renderPartyForm = (container, username, partyId = null, existingData = {}) => {
        const isEditing = !!partyId;
        container.className = 'material-item add-form';
        container.innerHTML = `<h4>${isEditing ? 'Редактировать' : 'Новая партия'}</h4><div class="form-group"><input type="text" p-holder="Название" value="${existingData.name || ''}"></div><div class="form-group"><textarea p-holder="Описание">${existingData.description || ''}</textarea></div><button class="save-btn">Сохранить</button><button class="cancel-btn">Отмена</button>`;
        container.querySelector('.save-btn').onclick = () => {
            const name = container.querySelector('input').value.trim();
            if (!name) { alert('Название не может быть пустым.'); return; }
            const description = container.querySelector('textarea').value.trim();
            const ref = isEditing ? projectRef.child('materials').child(username).child('parties').child(partyId) : projectRef.child('materials').child(username).child('parties').push();
            ref.set({ name, description, photos: existingData.photos || null });
            if (!isEditing) container.remove();
        };
        container.querySelector('.cancel-btn').onclick = () => { isEditing ? renderPartyItem(container, username, partyId, existingData) : container.remove(); };
    };

    const renderCostumeForm = (container, username, costumeId = null, existingData = {}) => {
        const isEditing = !!costumeId;
        container.className = 'material-item add-form';
        container.innerHTML = `<h4>${isEditing ? 'Редактировать' : 'Новый костюм'}</h4><div class="form-group"><input type="text" p-holder="Название" value="${existingData.name || ''}"></div><div class="form-group"><input type="text" p-holder="Ссылка" value="${existingData.link || ''}"></div><button class="save-btn">Сохранить</button><button class="cancel-btn">Отмена</button>`;
        container.querySelector('.save-btn').onclick = () => {
            const name = container.querySelector('input[p-holder="Название"]').value.trim();
            if (!name) { alert('Название не может быть пустым.'); return; }
            const link = container.querySelector('input[p-holder="Ссылка"]').value.trim();
            const ref = isEditing ? projectRef.child('materials').child(username).child('costumes').child(costumeId) : projectRef.child('materials').child(username).child('costumes').push();
            ref.set({ name, link, photos: existingData.photos || null });
            if (!isEditing) container.remove();
        };
        container.querySelector('.cancel-btn').onclick = () => { isEditing ? renderCostumeItem(container, username, costumeId, existingData) : container.remove(); };
    };

    const renderTaskForm = (container, username, taskId = null, existingData = {}) => {
        const isEditing = !!taskId;
        container.className = 'material-item add-form';
        container.innerHTML = `<h4>${isEditing ? 'Редактировать' : 'Новая задача'}</h4><div class="form-group"><input type="text" p-holder="Название" value="${existingData.name || ''}"></div><div class="form-group"><textarea p-holder="Описание">${existingData.description || ''}</textarea></div><button class="save-btn">Сохранить</button><button class="cancel-btn">Отмена</button>`;
        container.querySelector('.save-btn').onclick = () => {
            const name = container.querySelector('input').value.trim();
            if (!name) { alert('Название не может быть пустым.'); return; }
            const description = container.querySelector('textarea').value.trim();
            const ref = isEditing ? projectRef.child('materials').child(username).child('tasks').child(taskId) : projectRef.child('materials').child(username).child('tasks').push();
            ref.set({ name, description, status: existingData.status || 'incomplete' });
            if (!isEditing) container.remove();
        };
        container.querySelector('.cancel-btn').onclick = () => { isEditing ? renderTaskItem(container, username, taskId, existingData) : container.remove(); };
    };


    // --- ORIGINAL PAGE LOGIC (Trainings, Calendar, etc.) ---
    const renderProjectName = (name) => {
        projectNameHeader.textContent = name;
        document.title = name;
    };

    const renderTrainings = (trainings) => {
        trainingListEl.innerHTML = '';
        if (!trainings) {
            trainingListEl.innerHTML = '<li>Предстоящих тренировок нет.</li>';
            return;
        }
        const now = new Date();
        const upcomingTrainings = Object.values(trainings)
            .map(t => ({...t, date: new Date(t.startTime || t.time)}))
            .filter(t => t.date >= now && !isNaN(t.date))
            .sort((a, b) => a.date - b.date);
        if (upcomingTrainings.length === 0) {
            trainingListEl.innerHTML = '<li>Предстоящих тренировок нет.</li>';
            return;
        }
        upcomingTrainings.forEach(training => {
            const li = document.createElement('li');
            li.className = 'training-item';
            let formattedDate;
            if (training.startTime && training.endTime) {
                const startDate = new Date(training.startTime), endDate = new Date(training.endTime);
                const dateOpts = { day: 'numeric', month: 'short' }, timeOpts = { hour: '2-digit', minute: '2-digit' };
                const fStartDate = startDate.toLocaleDateString('ru-RU', dateOpts), fStartTime = startDate.toLocaleTimeString('ru-RU', timeOpts), fEndTime = endDate.toLocaleTimeString('ru-RU', timeOpts);
                formattedDate = startDate.toDateString() === endDate.toDateString() ? `${fStartDate}, ${fStartTime} - ${fEndTime}` : `${fStartDate} ${fStartTime} - ${endDate.toLocaleDateString('ru-RU', dateOpts)} ${fEndTime}`;
            } else if (training.time) {
                formattedDate = new Date(training.time).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
            }
            li.innerHTML = `<div class="training-details"><p><strong>Время:</strong> ${formattedDate || 'N/A'}</p><p><strong>Место:</strong> ${training.location || 'Не указано'}</p><p><strong>Комментарий:</strong> ${training.comment || 'Нет'}</p></div>`;
            trainingListEl.appendChild(li);
        });
    };

    const projectTrainingDates = new Set();
    const otherTrainingDates = new Set();

    const initializeCalendar = () => {
        if (calendar) calendar.destroy();
        calendar = new AirDatepicker('#calendar-container', {
            inline: true,
            locale: { days: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'], daysShort: ['Вос', 'Пон', 'Вто', 'Сре', 'Чет', 'Пят', 'Суб'], daysMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'], monthsShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'], today: 'Сегодня', clear: 'Очистить', dateFormat: 'dd.MM.yyyy', timeFormat: 'HH:mm', firstDay: 1 },
            onRenderCell: ({date, cellType}) => {
                if (cellType === 'day') {
                    const dateStr = date.toISOString().split('T')[0];
                    if (projectTrainingDates.has(dateStr)) return { classes: 'highlight-project-training' };
                    if (otherTrainingDates.has(dateStr)) return { classes: 'highlight-other-training' };
                }
            },
            onChangeView: () => {
                if (calendar) calendar.update();
            }
        });
    };

    const projectsRef = database.ref('projects');
    projectsRef.on('value', (snapshot) => {
        const allProjects = snapshot.val();
        if (!allProjects || !allProjects[projectId]) {
            alert('Проект не найден или был удален.');
            window.location.href = 'participant.html';
            return;
        }
        currentProject = allProjects[projectId];
        if (!currentProject.members || !currentProject.members[loggedInUser]) {
            alert('У вас нет доступа к этому проекту.');
            window.location.href = 'participant.html';
            return;
        }

        renderProjectName(currentProject.name);
        renderTrainings(currentProject.trainings);
        renderMyMaterials(currentProject.materials); // Render materials for the user

        projectTrainingDates.clear();
        otherTrainingDates.clear();
        for (const projId in allProjects) {
            const p = allProjects[projId];
            if (p.members && p.members[loggedInUser] && p.trainings) {
                const isCurrent = projId === projectId;
                Object.values(p.trainings).forEach(t => {
                    if (t.startTime || t.time) {
                        try {
                            const dateStr = new Date(t.startTime || t.time).toISOString().split('T')[0];
                            if (isCurrent) projectTrainingDates.add(dateStr); else otherTrainingDates.add(dateStr);
                        } catch (e) { console.error("Skipping invalid date:", t.startTime || t.time); }
                    }
                });
            }
        }
        if (!calendar) initializeCalendar(); else calendar.update();
    });

    window.addEventListener('beforeunload', () => {
        projectsRef.off('value');
    });
});