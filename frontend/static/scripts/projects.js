// Archivo: scripts/projects.js
// Obtiene proyectos desde el backend y actualiza las vistas del panel principal.

// Utilidad para construir URLs publicas de recursos alojados en el backend.
const resolveAssetUrl = (path) => {
    if (!path) {
        return null;
    }
    if (/^https?:\/\//i.test(path)) {
        return path;
    }
    const base = window.apiClient?.baseUrl ?? '';
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
};

window.resolveAssetUrl = window.resolveAssetUrl || resolveAssetUrl;

class ProjectsManager {
    constructor(options = {}) {
        this.options = { ...options };
        this.mode = this.options.mode || 'feed';
        this.projects = [];
        this.allProjects = [];
        this.masterProjects = [];
        this.currentProjectIndex = 0;
        this.viewedProjects = new Set();
        this.interactedProjectIds = new Set();
        this.includeInteracted = this.options.includeInteracted ?? false;
        if (this.mode === 'my-projects' || this.mode === 'member-projects') {
            this.includeInteracted = true;
        }
        this.searchQuery = '';
        this.currentUserProfile = null;
        this.currentUserId = null;
        this.ownedProjectIds = new Set();
        this.cardContainer = document.querySelector('.card-container');
        this.projectCard = document.getElementById('project-card');
        this.expandedCard = document.getElementById('expanded-card');
        this.searchInput = document.getElementById('search-projects');
        this.joinButton = null;
        this.rotateIcon = null;
        this.eventHandlersAttached = false;
        this.init();
    }

    /**
     * Inicializa el módulo validando la sesión y cargando la información remota.
     */
    async init() {
        if (!window.apiClient || !window.apiClient.auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        await this.loadUserInteractions();
        await this.loadProjects();
        this.renderCurrentProject();
        this.attachGlobalHandlers();
    }

    async loadUserInteractions() {
        this.interactedProjectIds = new Set();
        if (!window.apiClient) {
            return;
        }

        try {
            const profile = await window.apiClient.get('/api/users/profile');
            this.currentUserProfile = profile || null;
            const rawUserId = profile?.id;
            const parsedUserId = rawUserId !== null && rawUserId !== undefined ? Number(rawUserId) : null;
            this.currentUserId = Number.isFinite(parsedUserId) ? parsedUserId : null;
            const createdIdsSource = Array.isArray(profile?.createdProjectsIds)
                ? profile?.createdProjectsIds
                : Array.isArray(profile?.createdProjectIds)
                    ? profile?.createdProjectIds
                    : [];
            this.ownedProjectIds = new Set(
                (createdIdsSource || [])
                    .map((value) => {
                        const numeric = Number(value);
                        return Number.isFinite(numeric) ? numeric : null;
                    })
                    .filter((value) => value !== null)
            );
            const liked = Array.isArray(profile?.likedProjectsIds) ? profile.likedProjectsIds : [];
            const disliked = Array.isArray(profile?.dislikedProjectsIds) ? profile.dislikedProjectsIds : [];
            [...liked, ...disliked].forEach((projectId) => {
                const key = this.toProjectKey(projectId);
                if (key) {
                    this.interactedProjectIds.add(key);
                }
            });
        } catch (error) {
            console.warn('No se pudieron obtener las interacciones previas del usuario:', error);
        }
    }

    /**
     * Recupera la lista de proyectos desde el backend.
     */
    async loadProjects() {
        try {
            const response = await window.apiClient.get('/api/projects');
            const projects = Array.isArray(response) ? response : [];
            this.masterProjects = projects.map((project) => this.normalizeProject(project)).filter(Boolean);
            this.updateVisibleProjects({ resetView: true });
        } catch (error) {
            console.error('Error al cargar los proyectos:', error);
            this.masterProjects = [];
            this.allProjects = [];
            this.projects = [];
            this.viewedProjects.clear();
            this.currentProjectIndex = 0;
            this.showNoProjectsMessage('No se pudieron cargar los proyectos. Intentá nuevamente más tarde.');
        }
    }

    /**
     * Asegura que cada proyecto contenga la estructura que la interfaz espera.
     */
    normalizeProject(project) {
        if (!project) {
            return null;
        }

        const rawProgress = project.progress ?? project.stats?.progress ?? project.progressPercentage;
        let fallbackProgress = rawProgress;
        if (fallbackProgress == null && typeof project.teamCurrent === 'number' && typeof project.teamMax === 'number' && project.teamMax > 0) {
            fallbackProgress = (project.teamCurrent / project.teamMax) * 100;
        }
        const progress = this.clampProgress(fallbackProgress);
        const stats = {
            teamCurrent: project.teamCurrent ?? 0,
            teamMax: project.teamMax ?? 0,
            duration: project.duration || 'Por definir',
            language: project.language || 'Sin idioma',
            type: project.type || 'General',
            progress,
        };

        const technologies = (Array.isArray(project.technologies) ? project.technologies : [])
            .map((tech) => {
                if (typeof tech === 'string') {
                    const nombre = tech.trim();
                    return nombre ? { nombre, nivel: '' } : null;
                }
                const nombre = typeof tech?.nombre === 'string' ? tech.nombre.trim() : null;
                const nivel = typeof tech?.nivel === 'string' ? tech.nivel.trim() : '';
                return nombre ? { nombre, nivel } : null;
            })
            .filter(Boolean);

        const objectives = (Array.isArray(project.objectives) ? project.objectives : [])
            .map((objective) => {
                if (typeof objective === 'string') {
                    return objective.trim();
                }
                return typeof objective?.text === 'string' ? objective.text.trim() : null;
            })
            .filter(Boolean);

        const skillsNeeded = (Array.isArray(project.skillsNeeded) ? project.skillsNeeded : [])
            .filter((skill) => Boolean(skill))
            .map((skill) => ({
                nombre: typeof skill?.nombre === 'string' ? skill.nombre.trim() : null,
                nivel: typeof skill?.nivel === 'string' ? skill.nivel.trim() : 'Intermedio',
            }))
            .filter((skill) => Boolean(skill.nombre));

        const members = (Array.isArray(project.members) ? project.members : [])
            .map((member) => {
                if (!member) {
                    return null;
                }
                const rawName = typeof member.fullName === 'string' ? member.fullName.trim() : '';
                const name = rawName || 'Integrante sin nombre';
                const email = typeof member.email === 'string' ? member.email.trim() : '';
                const avatar = resolveAssetUrl(member.profilePictureUrl) || null;
                return {
                    id: typeof member.id === 'number' || typeof member.id === 'string' ? member.id : null,
                    name,
                    email,
                    avatar,
                    isCreator: Boolean(member.creator),
                };
            })
            .filter(Boolean);

        const statusValue = typeof project.status === 'string'
            ? project.status.toUpperCase()
            : typeof project.status?.name === 'string'
                ? project.status.name.toUpperCase()
                : 'ACTIVE';
        const numericProjectId = Number(project.id);
        const resolvedProjectId = Number.isFinite(numericProjectId) ? numericProjectId : (project.id ?? null);
        const numericCreatorId = Number(project.creatorId);
        const resolvedCreatorId = Number.isFinite(numericCreatorId) ? numericCreatorId : (project.creatorId ?? null);
        const isOwner = this.isProjectOwnedByCurrentUser(resolvedProjectId, resolvedCreatorId);
        const currentUserId = this.currentUserId;
        let isMember = Boolean(isOwner);
        if (!isMember && currentUserId !== null && currentUserId !== undefined) {
            const currentKey = String(currentUserId);
            isMember = members.some((m) => {
                const mid = m?.id;
                if (mid === null || mid === undefined) {
                    return false;
                }
                return String(mid) === currentKey;
            });
        }

        return {
            id: resolvedProjectId,
            title: project.title || 'Proyecto sin título',
            description: project.description || 'Sin descripción disponible.',
            bannerUrl: resolveAssetUrl(project.bannerUrl) || '/static/imagenes/coding-foto-ejemplo.jpg',
            stats,
            technologies,
            objectives,
            skillsNeeded,
            members,
            creatorId: resolvedCreatorId,
            isOwner,
            isMember,
            status: statusValue,
            repositoryUrl: project.repositoryUrl || null,
            contactEmail: project.contactEmail || null,
            progress,
        };
    }

    updateVisibleProjects({ resetView = false } = {}) {
        let baseList = this.includeInteracted
            ? [...this.masterProjects]
            : this.masterProjects.filter((project) => !this.interactedProjectIds.has(this.toProjectKey(project.id)));

        if (this.searchQuery) {
            baseList = baseList.filter((project) => this.matchesSearch(project, this.searchQuery));
        }

        if (this.mode === 'my-projects') {
            baseList = baseList.filter((project) => project?.isOwner);
        } else if (this.mode === 'member-projects') {
            baseList = baseList.filter((project) => project?.isMember);
        }

        this.allProjects = baseList;
        this.projects = [...baseList];

        if (resetView || this.projects.length === 0) {
            this.viewedProjects.clear();
        } else {
            const visibleIds = new Set(this.projects.map((project) => project.id));
            this.viewedProjects = new Set([...this.viewedProjects].filter((id) => visibleIds.has(id)));
        }

        if (resetView || this.currentProjectIndex >= this.projects.length) {
            this.currentProjectIndex = 0;
        }
    }

    matchesSearch(project, query) {
        if (!query) {
            return true;
        }

        const normalizedTitle = (project.title || '').toLowerCase();
        if (normalizedTitle.includes(query)) {
            return true;
        }

        const techMatch = project.technologies.some((tech) => {
            const value = typeof tech === 'string' ? tech : tech?.nombre || '';
            return value.toLowerCase().includes(query);
        });
        if (techMatch) {
            return true;
        }

        const skillMatch = project.skillsNeeded.some((skill) => {
            if (typeof skill === 'string') {
                return skill.toLowerCase().includes(query);
            }
            const value = `${skill?.nombre || ''} ${skill?.nivel || ''}`;
            return value.trim().toLowerCase().includes(query);
        });
        return skillMatch;
    }

    toProjectKey(value) {
        if (value === null || value === undefined) {
            return null;
        }
        return String(value);
    }

    isProjectOwnedByCurrentUser(projectId, creatorId) {
        if (projectId !== null && projectId !== undefined) {
            const numericProjectId = Number(projectId);
            if (Number.isFinite(numericProjectId) && this.ownedProjectIds.has(numericProjectId)) {
                return true;
            }
        }

        if (this.currentUserId !== null && this.currentUserId !== undefined && creatorId !== null && creatorId !== undefined) {
            const numericCreatorId = Number(creatorId);
            if (Number.isFinite(numericCreatorId)) {
                return numericCreatorId === this.currentUserId;
            }
            if (String(creatorId) === String(this.currentUserId)) {
                return true;
            }
        }

        return false;
    }

    markProjectAsInteracted(projectId) {
        const key = this.toProjectKey(projectId);
        if (!key) {
            return;
        }
        this.interactedProjectIds.add(key);
        this.updateVisibleProjects({ resetView: false });
    }

    /**
     * Renderiza el proyecto actual o muestra un mensaje si no hay datos.
     */
    renderCurrentProject() {
        if (this.projects.length === 0) {
            if (this.masterProjects.length === 0) {
                let emptyMessage;
                let emptyDescription;
                if (this.mode === 'my-projects') {
                    emptyMessage = 'Todavia no creaste proyectos.';
                    emptyDescription = 'Anda al feed y usa el boton "Crear proyecto" para publicar uno nuevo.';
                } else if (this.mode === 'member-projects') {
                    emptyMessage = 'Todavia no sos miembro de ningun proyecto.';
                    emptyDescription = 'Unite a proyectos desde el feed para verlos aca.';
                } else {
                    emptyMessage = 'Todavia no hay proyectos publicados. Crea el primero!';
                    emptyDescription = 'Podes crear un proyecto nuevo con el boton "Crear proyecto".';
                }
                this.showNoProjectsMessage(emptyMessage, emptyDescription);
            } else {
                this.showAllProjectsViewedMessage();
            }
            return;
        }

        const nextProject = this.getNextUnviewedProject();
        if (!nextProject) {
            this.showAllProjectsViewedMessage();
            return;
        }

        this.currentProjectIndex = this.projects.findIndex((project) => project.id === nextProject.id);
        this.updateProjectCard(nextProject);
        this.updateExpandedCard(nextProject);
        this.markProjectAsViewed(nextProject.id);
        this.ensureHandlers();
    }

    /**
     * Actualiza la tarjeta principal del carrusel.
     */
    updateProjectCard(project) {
        const title = this.projectCard?.querySelector('.card-title');
        const description = this.projectCard?.querySelector('.card-description');
        const image = this.projectCard?.querySelector('.card-image');
        const statsText = this.projectCard?.querySelectorAll('.stats-text');
        const techContainer = this.projectCard?.querySelector('.card-tech');

        if (title) {
            title.textContent = project.title;
        }
        if (description) {
            description.textContent = project.description;
        }
        if (image) {
            const bannerSrc = project.bannerUrl || '/static/imagenes/coding-foto-ejemplo.jpg';
            image.style.backgroundImage = `url('${bannerSrc}')`;
        }

        if (statsText?.length >= 4) {
            statsText[0].textContent = `${project.stats.teamCurrent}/${project.stats.teamMax}`;
            statsText[1].textContent = project.stats.duration;
            statsText[2].textContent = project.stats.language;
            statsText[3].textContent = project.stats.type;
        }

        if (techContainer) {
            techContainer.innerHTML = '';
            const technologies = project.technologies.length > 0 ? project.technologies : ['Tecnologías a definir'];
            technologies.slice(0, 4).forEach((tech) => {
                const badge = document.createElement('div');
                badge.className = 'tech-icon';
                badge.textContent = this.getInitials(typeof tech === 'string' ? tech : tech?.nombre);
                techContainer.appendChild(badge);
            });
        }
    }

    /**
     * Actualiza la tarjeta expandida con toda la información disponible.
     */
    updateExpandedCard(project) {
        if (!this.expandedCard) {
            return;
        }

        const expandedTitle = this.expandedCard.querySelector('.expanded-title');
        if (expandedTitle) {
            expandedTitle.textContent = project.title;
        }

        const statusBadge = this.expandedCard.querySelector('.status-badge');
        if (statusBadge) {
            const statusKey = (project.status || 'ACTIVE').toUpperCase();
            statusBadge.textContent = this.translateStatus(statusKey);
            const statusClassMap = {
                ACTIVE: 'active',
                INACTIVE: 'inactive',
                COMPLETED: 'completed',
                ON_HOLD: 'on-hold',
            };
            const statusClass = statusClassMap[statusKey] || '';
            statusBadge.className = `status-badge ${statusClass}`.trim();
        }

        const expandedImage = this.expandedCard.querySelector('.expanded-image img');
        if (expandedImage) {
            expandedImage.src = project.bannerUrl || '/static/imagenes/coding-foto-ejemplo.jpg';
        }

        const stats = project.stats || {
            teamCurrent: project.teamCurrent ?? 0,
            teamMax: project.teamMax ?? 0,
            duration: project.duration || 'Por definir',
            language: project.language || 'Sin idioma',
            type: project.type || 'General',
            progress: project.progress ?? 0,
        };

        const statValues = this.expandedCard.querySelectorAll('.stat-value');
        if (statValues.length >= 4) {
            const teamValue = `${stats.teamCurrent ?? 0}/${stats.teamMax ?? '??'}`;
            statValues[0].textContent = teamValue;
            statValues[1].textContent = stats.duration || 'Por definir';
            statValues[2].textContent = stats.language || 'Sin idioma';
            statValues[3].textContent = stats.type || 'General';
        }

        const progressValue = this.clampProgress(project.progress ?? stats.progress);
        project.progress = progressValue;
        stats.progress = progressValue;

        const progressFill = this.expandedCard.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progressValue}%`;
        }
        const progressText = this.expandedCard.querySelector('.progress-text');
        if (progressText) {
            progressText.textContent = `${progressValue}% completado`;
        }

        const descriptionSection = this.expandedCard.querySelector('.section-content');
        if (descriptionSection) {
            descriptionSection.textContent = project.description;
        }

        const membersContainer = this.expandedCard.querySelector('.members-list');
        this.renderMembersList(membersContainer, project.members);

        this.renderList(
            this.expandedCard.querySelector('.tech-grid'),
            project.technologies,
            (tech) => this.buildTechItem(tech),
        );

        this.renderList(
            this.expandedCard.querySelector('.objectives-list'),
            project.objectives,
            (objective) => this.buildObjectiveItem(objective),
        );

        this.renderList(
            this.expandedCard.querySelector('.skills-grid'),
            project.skillsNeeded,
            (skill) => this.buildSkillBadge(skill),
        );
    }

    renderMembersList(container, members) {
        if (!container) {
            return;
        }

        container.innerHTML = '';
        const normalizedMembers = Array.isArray(members) ? members : [];

        if (normalizedMembers.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'members-empty';
            emptyState.textContent = 'Aún no hay integrantes confirmados.';
            container.appendChild(emptyState);
            return;
        }

        normalizedMembers.forEach((member) => {
            const item = document.createElement('div');
            item.className = 'member-item';

            const avatar = document.createElement('div');
            avatar.className = 'member-avatar';
            if (member.avatar) {
                const img = document.createElement('img');
                img.src = member.avatar;
                img.alt = member.name || 'Integrante';
                avatar.appendChild(img);
            } else {
                avatar.textContent = this.getInitials(member.name);
            }

            const info = document.createElement('div');
            info.className = 'member-info';

            const name = document.createElement('span');
            name.className = 'member-name';
            name.textContent = member.name || 'Integrante sin nombre';
            info.appendChild(name);

            if (member.email) {
                const meta = document.createElement('span');
                meta.className = 'member-meta';
                meta.textContent = member.email;
                info.appendChild(meta);
            }

            if (member.isCreator) {
                const badge = document.createElement('span');
                badge.className = 'member-badge';
                badge.textContent = 'Creador';
                info.appendChild(badge);
            }

            item.appendChild(avatar);
            item.appendChild(info);
            container.appendChild(item);
        });
    }

    /**
     * Permite reutilizar la lógica de renderizado de listas.
     */
    renderList(container, items, builder) {
        if (!container) {
            return;
        }

        container.innerHTML = '';
        const normalizedItems = Array.isArray(items) && items.length > 0 ? items : ['Sin información disponible'];

        normalizedItems.forEach((item) => {
            const element = builder(item);
            if (element) {
                container.appendChild(element);
            }
        });
    }

    buildTechItem(tech) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tech-item';

        const icon = document.createElement('span');
        icon.className = 'tech-icon-expanded';
        icon.textContent = this.getInitials(typeof tech === 'string' ? tech : tech?.nombre);

        const details = document.createElement('div');
        details.className = 'tech-details';

        const name = document.createElement('span');
        name.className = 'tech-name';
        name.textContent = typeof tech === 'string' ? tech : tech?.nombre || 'Tecnología';

        const level = document.createElement('span');
        level.className = 'tech-level';
        const nivel = typeof tech === 'object' && tech?.nivel ? tech.nivel : '';
        level.textContent = nivel;

        details.appendChild(name);
        if (nivel) {
            details.appendChild(level);
        }

        wrapper.appendChild(icon);
        wrapper.appendChild(details);
        return wrapper;
    }

    buildObjectiveItem(objective) {
        const item = document.createElement('div');
        item.className = 'objective-item';
        item.textContent = typeof objective === 'string' ? objective : objective?.text || 'Objetivo pendiente';
        return item;
    }

    buildSkillBadge(skill) {
        const badge = document.createElement('div');
        badge.className = 'skill-badge';
        if (typeof skill === 'string') {
            badge.textContent = skill;
        } else if (skill && typeof skill === 'object') {
            const nombre = skill.nombre || 'Habilidad';
            const nivel = skill.nivel ? ` (${skill.nivel})` : '';
            badge.textContent = `${nombre}${nivel}`;
        } else {
            badge.textContent = 'Habilidad por definir';
        }
        return badge;
    }

    /**
     * Devuelve las iniciales de una cadena para las etiquetas circulares.
     */
    getInitials(text) {
        if (!text) {
            return 'N/A';
        }

        return text
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word[0])
            .join('')
            .slice(0, 3)
            .toUpperCase();
    }

    /**
     * Normaliza el porcentaje de avance recibido.
     */
    clampProgress(value) {
        if (value === null || value === undefined) {
            return 0;
        }

        let normalizedValue = value;

        if (typeof normalizedValue === 'string') {
            const match = normalizedValue.match(/-?\d+(?:[.,]\d+)?/);
            if (match) {
                normalizedValue = match[0].replace(',', '.');
            }
        }

        let numeric = Number(normalizedValue);
        if (!Number.isFinite(numeric)) {
            return 0;
        }

        if (numeric > 0 && numeric < 1) {
            numeric *= 100;
        }

        return Math.min(100, Math.max(0, Math.round(numeric)));
    }

    translateStatus(status) {
        const map = {
            ACTIVE: 'Activo',
            INACTIVE: 'En pausa',
            COMPLETED: 'Completado',
            ON_HOLD: 'En planificación',
        };
        return map[status] || 'Activo';
    }

    /**
     * Gestiona los listeners que dependen de los nodos renderizados.
     */
    ensureHandlers() {
        if (this.eventHandlersAttached) {
            return;
        }

        this.rotateIcon = document.querySelector('.rotate-icon');
        this.joinButton = document.querySelector('.action-btn.primary');

        this.rotateIcon?.addEventListener('click', () => this.nextProject());
        this.joinButton?.addEventListener('click', async () => {
            const project = this.getCurrentProject();
            if (!project) {
                return;
            }
            // Reutilizamos la misma lógica que el swipe hacia la derecha.
            await this.handleCardSwipe('right');
            const message = `Te uniste al proyecto "${project.title}"`;
            if (typeof window.showToastMessage === 'function') {
                window.showToastMessage(message, 'exito');
            } else {
                alert(message);
            }
        });

        const contactButton = document.querySelector('.action-btn.tertiary');
        contactButton?.addEventListener('click', () => {
            const project = this.getCurrentProject();
            if (!project || !project.contactEmail) {
                alert('El equipo aún no publicó un contacto.');
                return;
            }
            window.location.href = `mailto:${project.contactEmail}`;
        });

        this.eventHandlersAttached = true;
    }

    attachGlobalHandlers() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (event) => {
                const query = event.target.value;
                this.searchProjects(query);
            });
        }
    }

    /**
     * Marca un proyecto como visualizado para evitar repeticiones.
     */
    markProjectAsViewed(projectId) {
        if (projectId) {
            this.viewedProjects.add(projectId);
        }
    }

    getNextUnviewedProject() {
        return this.projects.find((project) => !this.viewedProjects.has(project.id)) || null;
    }

    getCurrentProject() {
        return this.projects[this.currentProjectIndex] || null;
    }

    nextProject() {
        if (this.projects.length === 0) {
            return;
        }

        this.currentProjectIndex = (this.currentProjectIndex + 1) % this.projects.length;
        const project = this.getCurrentProject();
        this.updateProjectCard(project);
        this.updateExpandedCard(project);
        this.markProjectAsViewed(project.id);
    }

    previousProject() {
        if (this.projects.length === 0) {
            return;
        }

        this.currentProjectIndex = (this.currentProjectIndex - 1 + this.projects.length) % this.projects.length;
        const project = this.getCurrentProject();
        this.updateProjectCard(project);
        this.updateExpandedCard(project);
    }

    restartProjects(includeInteracted = false) {
        this.includeInteracted = includeInteracted;
        this.updateVisibleProjects({ resetView: true });
        this.renderCurrentProject();
    }

    /**
     * Maneja los gestos de swipe que provienen de script.js.
     */
    async handleCardSwipe(direction) {
        const project = this.getCurrentProject();
        if (!project) {
            return;
        }

        if (this.mode === 'my-projects' || this.mode === 'member-projects') {
            if (direction === 'right') {
                this.nextProject();
            } else if (direction === 'left') {
                this.previousProject();
            } else if (direction === 'up') {
                this.updateExpandedCard(project);
                this.expandedCard?.classList.remove('hidden');
                this.expandedCard?.classList.add('visible');
            }
            return;
        }

        if (direction === 'right') {
            await this.registerLike(project.id);
            this.markProjectAsInteracted(project.id);
            this.renderCurrentProject();
        } else if (direction === 'left') {
            await this.registerDislike(project.id);
            this.markProjectAsInteracted(project.id);
            this.renderCurrentProject();
        } else if (direction === 'up') {
            this.updateExpandedCard(project);
            this.expandedCard?.classList.remove('hidden');
            this.expandedCard?.classList.add('visible');
        }
    }

    async registerLike(projectId) {
        if (!projectId) {
            return;
        }

        try {
            await window.apiClient.post(`/api/projects/${projectId}/like`);
        } catch (error) {
            console.error('No se pudo registrar el like:', error);
        }
    }

    async registerDislike(projectId) {
        if (!projectId) {
            return;
        }

        try {
            await window.apiClient.post(`/api/projects/${projectId}/dislike`);
        } catch (error) {
            console.error('No se pudo registrar el dislike:', error);
        }
    }

    /**
     * Permite filtrar proyectos por título, tecnologías o habilidades.
     */
    searchProjects(query) {
        this.searchQuery = (query || '').trim().toLowerCase();
        this.updateVisibleProjects({ resetView: true });
        this.renderCurrentProject();
    }

    showNoProjectsMessage(message, description = null) {
        if (!this.cardContainer) {
            return;
        }

        let resolvedDescription = description;
        if (resolvedDescription == null) {
            if (this.mode === 'my-projects') {
                resolvedDescription = 'Anda al feed y crea un proyecto para verlo aca.';
            } else if (this.mode === 'member-projects') {
                resolvedDescription = 'Unite a un proyecto desde el feed para verlo aca.';
            } else {
                resolvedDescription = 'Podes crear un proyecto nuevo con el boton "Crear proyecto".';
            }
        }

        this.cardContainer.innerHTML = `
            <div class="empty-state">
                <h2>${message}</h2>
                <p>${resolvedDescription}</p>
            </div>
        `;
        const indicators = document.getElementById('status-indicators');
        if (indicators) {
            indicators.style.display = 'none';
        }
    }

    showAllProjectsViewedMessage() {
        if (!this.cardContainer) {
            return;
        }

        let heading;
        let description;
        if (this.mode === 'my-projects') {
            heading = 'Ya recorriste todos tus proyectos';
            description = 'Volve al feed para crear uno nuevo o usa el boton "Editar" para actualizar los existentes.';
        } else if (this.mode === 'member-projects') {
            heading = 'Ya revisaste todos los proyectos donde sos miembro';
            description = 'Volve al feed para descubrir mas proyectos y sumarte a otros nuevos.';
        } else {
            heading = 'Ya revisaste todos los proyectos';
            description = 'Crea tu propio proyecto o espera otros nuevos.';
        }

        this.cardContainer.innerHTML = `
            <div class="all-projects-viewed-message">
                <div class="all-projects-icon">🎉</div>
                <h2>${heading}</h2>
                <p>${description}</p>
            </div>
        `;
    }

    getViewingStats() {
        const total = this.projects.length;
        const viewed = this.viewedProjects.size;
        const remaining = Math.max(total - viewed, 0);
        const percentage = total > 0 ? Math.round((viewed / total) * 100) : 0;
        return { total, viewed, remaining, percentage };
    }


    upsertProject(projectResponse, { focusCurrent = true } = {}) {
        const normalized = this.normalizeProject(projectResponse);
        if (!normalized || normalized.id === null || normalized.id === undefined) {
            return;
        }

        const replaceIn = (list) => {
            if (!Array.isArray(list)) {
                return false;
            }
            const index = list.findIndex((item) => item && item.id === normalized.id);
            if (index !== -1) {
                list[index] = normalized;
                return true;
            }
            return false;
        };

        let replaced = false;
        replaced = replaceIn(this.masterProjects) || replaced;
        replaced = replaceIn(this.allProjects) || replaced;
        replaced = replaceIn(this.projects) || replaced;

        if (!replaced) {
            this.masterProjects.push(normalized);
        }

        if (focusCurrent) {
            this.viewedProjects.delete(normalized.id);
        }

        this.updateVisibleProjects({ resetView: false });

        if (focusCurrent) {
            const index = this.projects.findIndex((item) => item && item.id === normalized.id);
            if (index !== -1) {
                this.currentProjectIndex = index;
            }
        }

        const current = this.getCurrentProject();
        if (current && current.id === normalized.id) {
            this.updateProjectCard(normalized);
            this.updateExpandedCard(normalized);
        }

        if (focusCurrent) {
            this.renderCurrentProject();
        }
    }

    /**
     * Agrega un proyecto recién creado sin recargar toda la lista.
     */
    addProject(projectResponse) {
        const normalized = this.normalizeProject(projectResponse);
        if (!normalized) {
            return;
        }

        this.masterProjects.unshift(normalized);
        this.updateVisibleProjects({ resetView: true });
        this.renderCurrentProject();
    }
}

window.ProjectsManager = ProjectsManager;

// Instancia global para que otros scripts puedan interactuar.
document.addEventListener('DOMContentLoaded', () => {
    const viewMode = document.body?.dataset?.viewMode || 'feed';
    let ManagerClass = ProjectsManager;

    if (typeof window.resolveProjectsManagerClass === 'function') {
        const resolved = window.resolveProjectsManagerClass(viewMode, ProjectsManager);
        if (resolved) {
            ManagerClass = resolved;
        }
    }

    window.projectsManager = new ManagerClass({ mode: viewMode });
});

// Funciones auxiliares utilizadas por otras partes del frontend.
function loadNextProject() {
    window.projectsManager?.nextProject();
}

function loadPreviousProject() {
    window.projectsManager?.previousProject();
}

function refreshProjectList() {
    window.projectsManager?.restartProjects();
}

function handleSwipe(direction) {
    window.projectsManager?.handleCardSwipe(direction);
}

function getViewingStats() {
    return window.projectsManager?.getViewingStats() ?? null;
}


