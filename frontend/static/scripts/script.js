// Archivo: static/scripts/script.js
// Maneja las interacciones visuales del feed (swipe de tarjetas y modal de creación de proyectos).

// Muestra mensajes emergentes en pantalla.
const showToastMessage = (mensaje, tipo = 'info') => {
    const colores = {
        exito: '#16a34a',
        error: '#dc2626',
        info: '#2563eb',
        aviso: '#ca8a04'
    };
    const fondo = colores[tipo] || colores.info;
    const aviso = document.createElement('div');
    aviso.textContent = mensaje;
    aviso.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 12000;
        background: ${fondo};
        color: #fff;
        padding: 12px 18px;
        border-radius: 10px;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.18);
        font-size: 14px;
        max-width: 280px;
        line-height: 1.4;
    `;
    document.body.appendChild(aviso);
    setTimeout(() => aviso.remove(), 4000);
};

document.addEventListener('DOMContentLoaded', () => {
    const expandedCard = document.getElementById('expanded-card');
    const closeExpanded = document.getElementById('close-expanded');
    const projectCard = document.getElementById('project-card');
    const statusIndicators = document.getElementById('status-indicators');
    const likeIndicator = statusIndicators?.querySelector('.like-indicator');
    const dislikeIndicator = statusIndicators?.querySelector('.dislike-indicator');
    const ampliarIndicator = statusIndicators?.querySelector('.ampliar-indicator');

    const createProjectBtn = document.getElementById('create-project-btn');
    const createProjectCard = document.getElementById('create-project-card');
    const createProjectContainer = document.querySelector('.create-project-container');
    const cancelCreate = document.getElementById('cancel-create');
    const createForm = document.getElementById('create-form');
    const projectImageInput = document.getElementById('project-image');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const removeImageBtn = document.getElementById('remove-image');
    const imagePlaceholder = imagePreview?.querySelector('.image-placeholder');
    let selectedImageDataUrl = null;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let expandedView = false;

    function openCreateModal() {
        if (!createProjectCard) return;
        createProjectCard.classList.remove('hidden');
        requestAnimationFrame(() => createProjectCard.classList.add('visible'));
    }

    function closeCreateModal() {
        if (!createProjectCard) return;
        createProjectCard.classList.remove('visible');
        setTimeout(() => {
            createProjectCard.classList.add('hidden');
            createForm?.reset();
            resetImagePreview();
        }, 300);
    }

    function resetImagePreview() {
        selectedImageDataUrl = null;
        if (previewImg) {
            previewImg.src = '';
            previewImg.style.display = 'none';
        }
        if (removeImageBtn) {
            removeImageBtn.style.display = 'none';
        }
        if (imagePlaceholder) {
            imagePlaceholder.style.display = 'flex';
        }
    }

    projectImageInput?.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) {
            resetImagePreview();
            return;
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            selectedImageDataUrl = loadEvent.target?.result || null;
            if (previewImg) {
                previewImg.src = selectedImageDataUrl;
                previewImg.style.display = 'block';
            }
            if (removeImageBtn) {
                removeImageBtn.style.display = 'block';
            }
            if (imagePlaceholder) {
                imagePlaceholder.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);
    });

    removeImageBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        resetImagePreview();
        if (projectImageInput) {
            projectImageInput.value = '';
        }
    });

    createProjectBtn?.addEventListener('click', openCreateModal);

    createProjectCard?.addEventListener('click', (event) => {
        if (event.target === createProjectCard) {
            closeCreateModal();
        }
    });

    cancelCreate?.addEventListener('click', closeCreateModal);

    closeExpanded?.addEventListener('click', () => {
        if (!expandedCard) return;
        expandedCard.classList.remove('visible');
        setTimeout(() => {
            expandedCard.classList.add('hidden');
            expandedView = false;
            document.body.classList.remove('hide-hero');
        }, 300);
    });

    function splitByComma(value) {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function splitByLine(value) {
        return value
            .split(/\r?\n|;/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function parseTeamMax(rawValue) {
        if (!rawValue) return null;
        const numbers = rawValue.match(/\d+/g);
        if (!numbers || numbers.length === 0) {
            return null;
        }
        return parseInt(numbers[numbers.length - 1], 10);
    }

    function buildProjectPayload() {
        const title = document.getElementById('project-name')?.value.trim();
        const status = document.getElementById('project-status')?.value;
        const teamSizeRaw = document.getElementById('team-size')?.value.trim();
        const duration = document.getElementById('duration')?.value.trim();
        const language = document.getElementById('language')?.value;
        const type = document.getElementById('project-type')?.value;
        const description = document.getElementById('description')?.value.trim();
        const technologiesRaw = document.getElementById('technologies')?.value || '';
        const skillsRaw = document.getElementById('skills')?.value || '';
        const objectivesRaw = document.getElementById('objectives')?.value || '';
        const progressRaw = document.getElementById('progress')?.value;

        const teamMax = parseTeamMax(teamSizeRaw);
        const technologies = splitByComma(technologiesRaw);
        const objectives = splitByLine(objectivesRaw);
        const skillsNeeded = splitByComma(skillsRaw).map((nombre) => ({ nombre, nivel: 'Intermedio' }));
        const progressNumber = progressRaw === undefined || progressRaw === null || progressRaw === '' ? null : Number(progressRaw);
        const progress = Number.isFinite(progressNumber) ? Math.min(100, Math.max(0, Math.round(progressNumber))) : null;

        return {
            title,
            description,
            status: status || 'ACTIVE',
            language: language || 'Español',
            type: type || 'General',
            duration: duration || null,
            teamMax,
            technologies,
            objectives,
            skillsNeeded,
            progress,
        };
    }

    createForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!window.apiClient) {
            showToastMessage('No se puede acceder al servidor.', 'error');
            return;
        }

        const payload = buildProjectPayload();
        if (!payload.title || !payload.description) {
            showToastMessage('Completa al menos el nombre y la descripcion.', 'aviso');
            return;
        }

        const bannerFile = projectImageInput?.files?.[0];
        if (!bannerFile) {
            showToastMessage('Selecciona un banner para el proyecto.', 'aviso');
            return;
        }

        const formData = new FormData();
        formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
        formData.append('banner', bannerFile);

        try {
            const created = await window.apiClient.post('/api/projects', formData);
            window.projectsManager?.addProject(created);
            showToastMessage('Proyecto creado correctamente.', 'exito');
            closeCreateModal();
        } catch (error) {
            const message = error?.message || 'No se pudo crear el proyecto.';
            showToastMessage(message, 'error');
        }
    });

    projectCard?.addEventListener('mousedown', startDrag);
    projectCard?.addEventListener('touchstart', startDrag);
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('touchmove', moveDrag, { passive: false });
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchend', endDrag);

    function startDrag(event) {
        if (!projectCard || expandedView) return;
        createProjectContainer?.classList.add('dragging');
        isDragging = true;
        offsetX = 0;
        offsetY = 0;
        projectCard.style.transition = 'none';

        if (event.type === 'touchstart') {
            startX = event.touches[0].clientX;
            startY = event.touches[0].clientY;
        } else {
            startX = event.clientX;
            startY = event.clientY;
        }
    }

    function moveDrag(event) {
        if (!isDragging || !projectCard || expandedView) return;

        let currentX;
        let currentY;

        if (event.type === 'touchmove') {
            event.preventDefault();
            currentX = event.touches[0].clientX;
            currentY = event.touches[0].clientY;
        } else {
            currentX = event.clientX;
            currentY = event.clientY;
        }

        offsetX = currentX - startX;
        offsetY = currentY - startY;

        const rotate = offsetX * 0.1;
        projectCard.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotate}deg)`;
        updateIndicators();
    }

    function updateIndicators() {
        if (!statusIndicators) return;
        statusIndicators.style.opacity = '1';

        if (offsetX > 60) {
            likeIndicator && (likeIndicator.style.opacity = '1');
            dislikeIndicator && (dislikeIndicator.style.opacity = '0');
            ampliarIndicator && (ampliarIndicator.style.opacity = '0');
        } else if (offsetX < -60) {
            likeIndicator && (likeIndicator.style.opacity = '0');
            dislikeIndicator && (dislikeIndicator.style.opacity = '1');
            ampliarIndicator && (ampliarIndicator.style.opacity = '0');
        } else if (offsetY < -60) {
            likeIndicator && (likeIndicator.style.opacity = '0');
            dislikeIndicator && (dislikeIndicator.style.opacity = '0');
            ampliarIndicator && (ampliarIndicator.style.opacity = '1');
        } else {
            likeIndicator && (likeIndicator.style.opacity = '0');
            dislikeIndicator && (dislikeIndicator.style.opacity = '0');
            ampliarIndicator && (ampliarIndicator.style.opacity = '0');
        }
    }

    function endDrag() {
        createProjectContainer?.classList.remove('dragging');
        if (!isDragging || !projectCard) return;
        isDragging = false;

        statusIndicators && (statusIndicators.style.opacity = '0');

        const horizontalThreshold = 120;
        const verticalThreshold = 150;

        if (offsetX > horizontalThreshold) {
            animateSwipe('right');
        } else if (offsetX < -horizontalThreshold) {
            animateSwipe('left');
        } else if (offsetY < -verticalThreshold) {
            projectCard.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
            projectCard.style.transform = `translate(0, -${window.innerHeight}px) rotate(0deg)`;
            projectCard.style.opacity = '0';
            setTimeout(() => {
                expandedCard?.classList.remove('hidden');
                expandedCard?.classList.add('visible');
                expandedView = true;
                resetCardPosition(false);
                document.body.classList.add('hide-hero');
            }, 300);
            handleSwipe('up');
        } else {
            resetCardPosition();
        }
    }

    function animateSwipe(direction) {
        if (!projectCard) return;
        const horizontalDistance = direction === 'right' ? window.innerWidth : -window.innerWidth;
        const rotation = direction === 'right' ? 25 : -25;
        const verticalOffset = Math.max(Math.min(offsetY, 200), -200);
        projectCard.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
        projectCard.style.transform = `translate(${horizontalDistance}px, ${verticalOffset}px) rotate(${rotation}deg)`;
        projectCard.style.opacity = '0';
        setTimeout(() => finalizeSwipe(direction), 320);
    }

    function finalizeSwipe(direction) {
        const swipeResult = handleSwipe(direction);
        Promise.resolve(swipeResult).finally(() => {
            if (!projectCard) return;
            requestAnimationFrame(() => {
                projectCard.style.transition = 'none';
                projectCard.style.transform = `translate(${direction === 'right' ? 40 : -40}px, 0) rotate(0deg)`;
                projectCard.style.opacity = '0';
                requestAnimationFrame(() => {
                    projectCard.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                    projectCard.style.opacity = '1';
                    projectCard.style.transform = 'translate(0, 0) rotate(0deg)';
                });
            });
        });
    }

    function resetCardPosition(animate = true) {
        if (!projectCard) return;
        projectCard.style.transition = animate ? 'transform 0.3s ease, opacity 0.3s ease' : 'none';
        projectCard.style.transform = 'translate(0, 0) rotate(0deg)';
        projectCard.style.opacity = '1';
    }
});






