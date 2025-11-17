(() => {
    const clampProgress = (value) => {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return null;
        }
        return Math.min(100, Math.max(0, Math.round(numeric)));
    };

    const splitByComma = (value = '') =>
        value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

    const splitByLine = (value = '') =>
        value
            .split(/\r?\n|;/)
            .map((item) => item.trim())
            .filter(Boolean);

    const parseSkillsList = (value = '') =>
        value
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                let nombre = line;
                let nivel = 'Intermedio';

                if (line.includes('|')) {
                    const [namePart, levelPart] = line.split('|');
                    nombre = namePart.trim();
                    nivel = (levelPart || '').trim() || 'Intermedio';
                } else if (line.includes('-')) {
                    const [namePart, levelPart] = line.split('-');
                    nombre = namePart.trim();
                    nivel = (levelPart || '').trim() || 'Intermedio';
                } else if (line.includes('(') && line.includes(')')) {
                    const match = line.match(/\(([^)]+)\)/);
                    if (match) {
                        nivel = match[1].trim() || 'Intermedio';
                        nombre = line.replace(match[0], '').trim();
                    }
                }

                if (!nombre) {
                    return null;
                }

                return {
                    nombre,
                    nivel: nivel || 'Intermedio',
                };
            })
            .filter(Boolean);

    const getTechName = (tech) => {
        if (typeof tech === 'string') {
            return tech;
        }
        if (tech && typeof tech === 'object') {
            return tech.nombre || tech.name || '';
        }
        return '';
    };

    const getSkillDisplay = (skill) => {
        if (!skill) {
            return '';
        }
        if (typeof skill === 'string') {
            return skill;
        }
        const nombre = skill.nombre || '';
        const nivel = skill.nivel || '';
        return nivel ? `${nombre} | ${nivel}` : nombre;
    };

    const TOAST = (message, type = 'info') => {
        if (typeof showToastMessage === 'function') {
            showToastMessage(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    };

    window.resolveProjectsManagerClass = (viewMode, BaseClass) => {
        if (viewMode !== 'my-projects') {
            return null;
        }

        class MyProjectsManager extends BaseClass {
            constructor() {
                super({ mode: 'my-projects' });
                this.editingProject = null;
                this.pendingBannerFile = null;
                this.interestedCounts = new Map();
                this.bindOwnerElements();
                this.bindRatingElements();
            }

            bindOwnerElements() {
                this.editButton = document.getElementById('edit-project-button');
                this.viewInterestedButton = document.getElementById('view-interested-button');
                this.expandedEditButton = document.getElementById('expanded-edit-button');
                this.expandedInterestedButton = document.getElementById('expanded-interested-button');

                this.editModal = document.getElementById('project-edit-modal');
                this.editForm = document.getElementById('project-edit-form');
                this.closeEditBtn = document.getElementById('close-project-edit');
                this.cancelEditBtn = document.getElementById('cancel-project-edit');
                this.bannerInput = document.getElementById('edit-project-banner');
                this.bannerPreview = document.getElementById('edit-banner-preview');
                this.removeBannerButton = document.getElementById('remove-edit-banner');

                this.titleInput = document.getElementById('edit-project-title');
                this.statusSelect = document.getElementById('edit-project-status');
                this.durationInput = document.getElementById('edit-project-duration');
                this.languageInput = document.getElementById('edit-project-language');
                this.typeInput = document.getElementById('edit-project-type');
                this.teamMaxInput = document.getElementById('edit-project-team-max');
                this.descriptionInput = document.getElementById('edit-project-description');
                this.technologiesInput = document.getElementById('edit-project-technologies');
                this.objectivesInput = document.getElementById('edit-project-objectives');
                this.skillsInput = document.getElementById('edit-project-skills');
                this.progressInput = document.getElementById('edit-project-progress');
                this.subtitle = document.querySelector('.edit-subtitle');

                const editButtons = [this.editButton, this.expandedEditButton];
                editButtons.forEach((button) =>
                    button?.addEventListener('click', (event) => {
                        event.preventDefault();
                        this.openEditModal();
                    }),
                );

                const interestedButtons = [this.viewInterestedButton, this.expandedInterestedButton];
                interestedButtons.forEach((button) =>
                    button?.addEventListener('click', (event) => {
                        event.preventDefault();
                        this.goToInterestedView();
                    }),
                );

                this.closeEditBtn?.addEventListener('click', () => this.closeEditModal());
                this.cancelEditBtn?.addEventListener('click', () => this.closeEditModal());

                this.editForm?.addEventListener('submit', (event) => this.handleEditSubmit(event));

                this.bannerInput?.addEventListener('change', (event) => this.handleBannerChange(event));
                this.removeBannerButton?.addEventListener('click', (event) => {
                    event.preventDefault();
                    this.clearBannerSelection();
                });

                window.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape' && this.editModal && this.editModal.classList.contains('visible')) {
                        this.closeEditModal();
                    }
                });
            }

            renderMembersList(container, members) {
                if (!container) {
                    return;
                }

                container.innerHTML = '';
                const normalizedMembers = Array.isArray(members) ? members : [];
                const project = this.getCurrentProject();

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
                    item.dataset.userId = member.userId || member.id;

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

                    const nameContainer = document.createElement('div');
                    nameContainer.style.display = 'flex';
                    nameContainer.style.alignItems = 'center';
                    nameContainer.style.gap = '8px';

                    const name = document.createElement('span');
                    name.className = 'member-name';
                    name.textContent = member.name || 'Integrante sin nombre';
                    nameContainer.appendChild(name);

                    // Add profile view button for all members (except current user)
                    const memberUserId = member.userId || member.id;
                    if (memberUserId !== this.currentUserId) {
                        const profileButton = document.createElement('button');
                        profileButton.className = 'view-profile-btn';
                        profileButton.innerHTML = '👤';
                        profileButton.title = 'Ver perfil';
                        profileButton.style.cssText = `
                            background: none;
                            border: none;
                            cursor: pointer;
                            font-size: 16px;
                            color: #363F72;
                            padding: 2px;
                            border-radius: 4px;
                            transition: background-color 0.2s;
                        `;
                        profileButton.addEventListener('mouseover', () => {
                            profileButton.style.backgroundColor = '#f0f0f0';
                        });
                        profileButton.addEventListener('mouseout', () => {
                            profileButton.style.backgroundColor = 'transparent';
                        });
                        profileButton.addEventListener('click', () => {
                            window.location.href = `/profile/${memberUserId}`;
                        });
                        nameContainer.appendChild(profileButton);
                    }

                    // Add rate button if current user is creator and not rating themselves
                    if (project && this.currentUserId === project.creatorId && memberUserId !== this.currentUserId) {
                        const rateButton = document.createElement('button');
                        rateButton.className = 'rate-member-btn';
                        rateButton.textContent = '⭐';
                        rateButton.title = 'Calificar miembro';
                        rateButton.style.cssText = `
                            background: none;
                            border: none;
                            cursor: pointer;
                            font-size: 16px;
                            color: #363F72;
                            padding: 2px;
                            border-radius: 4px;
                            transition: background-color 0.2s;
                        `;
                        rateButton.addEventListener('mouseover', () => {
                            rateButton.style.backgroundColor = '#f0f0f0';
                        });
                        rateButton.addEventListener('mouseout', () => {
                            rateButton.style.backgroundColor = 'transparent';
                        });
                        rateButton.addEventListener('click', () => this.showRatingModal(member, project));
                        nameContainer.appendChild(rateButton);
                    }

                    info.appendChild(nameContainer);

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

            // --- Inicio: Nuevos métodos para calificación ---

            bindRatingElements() {
                this.ratingModal = document.getElementById('rating-modal');
                this.closeRatingModalBtn = document.getElementById('close-rating-modal');
                this.cancelRatingBtn = document.getElementById('cancel-rating');
                this.ratingForm = document.getElementById('rating-form');
                this.ratingUserName = document.getElementById('rating-user-name');
                this.ratingUserAvatar = document.getElementById('rating-user-avatar');
                this.starRatingInputContainer = document.getElementById('star-rating-input');
                this.ratingValueInput = document.getElementById('rating-value-input');
                this.ratingComment = document.getElementById('rating-comment');
                this.ratingStars = this.starRatingInputContainer?.querySelectorAll('.star');

                this.closeRatingModalBtn?.addEventListener('click', () => this.closeRatingModal());
                this.cancelRatingBtn?.addEventListener('click', () => this.closeRatingModal());
                this.ratingForm?.addEventListener('submit', (e) => this.handleRatingSubmit(e));

                this.ratingStars?.forEach((star) => {
                    star.addEventListener('click', () => {
                        const value = star.dataset.value;
                        this.setStarRating(value);
                    });
                });

                window.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape' && this.ratingModal && this.ratingModal.classList.contains('visible')) {
                        this.closeRatingModal();
                    }
                });
            }

            setStarRating(value) {
                const rating = parseInt(value, 10) || 0;
                this.ratingValueInput.value = rating;
                this.starRatingInputContainer.dataset.rating = rating;
                this.ratingStars.forEach((star) => {
                    if (parseInt(star.dataset.value, 10) <= rating) {
                        star.classList.add('selected');
                    } else {
                        star.classList.remove('selected');
                    }
                });
            }

            openRatingModal(member, projectId) {
                if (!member || !projectId || !this.ratingModal) {
                    return;
                }
                this.ratingModal.dataset.projectId = projectId;
                this.ratingModal.dataset.ratedUserId = member.userId || member.id;
                this.ratingUserName.textContent = member.name || 'Miembro';
                this.ratingUserAvatar.src = member.avatarSrc || '/static/imagenes/profile-placeholder.svg';

                this.setStarRating(0);
                this.ratingComment.value = '';

                this.ratingModal.classList.remove('hidden');
                requestAnimationFrame(() => this.ratingModal?.classList.add('visible'));
            }

            closeRatingModal() {
                if (!this.ratingModal) {
                    return;
                }
                this.ratingModal.classList.remove('visible');
                setTimeout(() => {
                    this.ratingModal?.classList.add('hidden');
                    this.ratingForm?.reset();
                    delete this.ratingModal.dataset.projectId;
                    delete this.ratingModal.dataset.ratedUserId;
                }, 220);
            }

            async handleRatingSubmit(event) {
                event.preventDefault();
                const projectId = this.ratingModal.dataset.projectId;
                const ratedUserId = this.ratingModal.dataset.ratedUserId;
                const rating = parseInt(this.ratingValueInput.value, 10);
                const comment = this.ratingComment.value.trim();

                if (!projectId || !ratedUserId) {
                    TOAST('Error: No se pudo identificar al usuario o proyecto.', 'error');
                    return;
                }
                if (rating < 1 || rating > 5) {
                    TOAST('Por favor, selecciona una calificación de 1 a 5 estrellas.', 'aviso');
                    return;
                }

                const payload = {
                    ratedUserId: Number(ratedUserId),
                    rating,
                    comment: comment || null,
                    projectId: Number(projectId),
                };

                try {
                    await window.apiClient.post('/api/user-ratings', payload);
                    TOAST('Calificación enviada con éxito.', 'exito');
                    this.closeRatingModal();
                } catch (error) {
                    const message =
                        error?.data?.message ||
                        error?.data?.detail ||
                        error?.message ||
                        'No se pudo enviar la calificación.';
                    TOAST(message, 'error');
                }
            }

            makeMembersRatable(project) {
                const membersListContainer = this.expandedCard?.querySelector('.members-list');
                if (!membersListContainer || !project?.id) {
                    return;
                }
                const currentUserId = window.apiClient.auth.getUser()?.id;
                if (!currentUserId) {
                    return;
                }

                const memberItems = membersListContainer.querySelectorAll('.member-item');
                memberItems.forEach((item) => {
                    const memberId = item.dataset.userId;
                    if (!memberId) {
                        return;
                    }
                    
                    // Solo se puede calificar a otros miembros, no al creador (uno mismo)
                    if (Number(memberId) !== currentUserId) {
                        item.classList.add('ratable-member');
                        item.title = 'Calificar a este miembro';

                        const memberName = item.querySelector('.member-name')?.textContent || 'Miembro';
                        const memberAvatarSrc = item.querySelector('.member-avatar img')?.src;
                        
                        // Evitar doble listener
                        if (!item.dataset.ratingListener) {
                            item.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                this.openRatingModal({ userId: memberId, name: memberName, avatarSrc }, project.id);
                            });
                            item.dataset.ratingListener = 'true';
                        }
                    }
                });
            }

            // --- Fin: Nuevos métodos para calificación ---

            updateProjectCard(project) {
                super.updateProjectCard(project);
                this.updateOwnerButtons(project);
            }

            updateExpandedCard(project) {
                super.updateExpandedCard(project);
                this.alignExpandedMarkupToFeed();
                this.updateOwnerButtons(project);
            }

            alignExpandedMarkupToFeed() {
                const root = this.expandedCard;
                if (!root) return;

                // 1) Alinear etiqueta del 4to stat a "Tipo"
                try {
                    const statLabels = root.querySelectorAll('.expanded-stats-grid .stat-item .stat-content .stat-label');
                    if (statLabels && statLabels.length >= 4) {
                        statLabels[3].textContent = 'Tipo';
                    }
                } catch (_) {}

                // 2) Alinear contenedor de progreso a la estructura del feed
                try {
                    const progressSection = root.querySelector('.progress-section');
                    if (progressSection) {
                        progressSection.classList.add('expanded-progress');
                        if (!progressSection.querySelector('.progress-label')) {
                            const label = document.createElement('div');
                            label.className = 'progress-label';
                            label.textContent = 'Avance del proyecto';
                            progressSection.insertBefore(label, progressSection.firstChild);
                        }
                    }
                } catch (_) {}

                // 3) Alinear titulos de secciones al formato del feed
                try {
                    const sectionHeadings = root.querySelectorAll('.expanded-right .section > h3');
                    sectionHeadings.forEach((h3) => {
                        h3.classList.add('section-title');
                        const text = (h3.textContent || '').trim().toLowerCase();
                        if (text.includes('resumen')) h3.textContent = 'Descripción';
                        if (text.includes('tecnolog')) h3.textContent = 'Tecnologías';
                        if (text.includes('objetivo')) h3.textContent = 'Objetivos';
                        if (text.includes('habilidad')) h3.textContent = 'Aptitudes requeridas';
                    });
                } catch (_) {}
            }

            updateOwnerButtons(project) {
                const hasProject = Boolean(project?.id);
                const projectId = hasProject ? project.id : null;

                const buttons = [
                    this.editButton,
                    this.viewInterestedButton,
                    this.expandedEditButton,
                    this.expandedInterestedButton,
                ];
                buttons.forEach((button) => {
                    if (!button) {
                        return;
                    }
                    button.disabled = !hasProject;
                    if (hasProject) {
                        button.dataset.projectId = projectId;
                    } else {
                        delete button.dataset.projectId;
                    }
                });

                if (hasProject && this.subtitle) {
                    const createdAt = project.createdAt ? `Creado el ${project.createdAt}` : '';
                    const updatedAt = project.updatedAt ? `Actualizado el ${project.updatedAt}` : '';
                    this.subtitle.textContent =
                        [project.title ? `Estas editando ${project.title}` : '', updatedAt || createdAt]
                            .filter(Boolean)
                            .join(' • ') || 'Actualiza la informacion y manten a tu equipo siempre alineado.';
                }
            }

            openEditModal() {
                const project = this.getCurrentProject();
                if (!project) {
                    TOAST('Todavia no hay un proyecto seleccionado.', 'aviso');
                    return;
                }

                this.editingProject = project;
                this.pendingBannerFile = null;
                this.populateEditForm(project);

                if (!this.editModal) {
                    return;
                }
                this.editModal.classList.remove('hidden');
                requestAnimationFrame(() => this.editModal?.classList.add('visible'));
            }

            closeEditModal() {
                if (!this.editModal) {
                    return;
                }
                this.editModal.classList.remove('visible');
                setTimeout(() => {
                    this.editModal?.classList.add('hidden');
                    this.editForm?.reset();
                    this.resetBannerPreview();
                    this.pendingBannerFile = null;
                    this.editingProject = null;
                }, 220);
            }

            populateEditForm(project) {
                const stats = project?.stats || {};

                if (this.titleInput) {
                    this.titleInput.value = project?.title || '';
                }
                if (this.descriptionInput) {
                    this.descriptionInput.value = project?.description || '';
                }
                if (this.statusSelect) {
                    this.statusSelect.value = (project?.status || 'ACTIVE').toUpperCase();
                }
                if (this.durationInput) {
                    this.durationInput.value = stats.duration || project?.duration || '';
                }
                if (this.languageInput) {
                    this.languageInput.value = stats.language || project?.language || '';
                }
                if (this.typeInput) {
                    this.typeInput.value = stats.type || project?.type || '';
                }
                if (this.teamMaxInput) {
                    const teamMax = stats.teamMax ?? project?.teamMax ?? '';
                    this.teamMaxInput.value = teamMax ? String(teamMax) : '';
                }
                if (this.technologiesInput) {
                    const technologies = (project?.technologies || []).map(getTechName).filter(Boolean).join(', ');
                    this.technologiesInput.value = technologies;
                }
                if (this.objectivesInput) {
                    const objectives = (project?.objectives || []).join('\n');
                    this.objectivesInput.value = objectives;
                }
                if (this.skillsInput) {
                    const skills = (project?.skillsNeeded || []).map(getSkillDisplay).filter(Boolean).join('\n');
                    this.skillsInput.value = skills;
                }
                if (this.progressInput) {
                    const progress = clampProgress(project?.progress ?? stats.progress);
                    this.progressInput.value = progress === null || progress === undefined ? '' : String(progress);
                }

                if (this.bannerPreview) {
                    this.bannerPreview.src = project?.bannerUrl || '/static/imagenes/coding-foto-ejemplo.jpg';
                }
            }

            handleBannerChange(event) {
                const file = event.target?.files?.[0];
                if (!file || !file.type.startsWith('image/')) {
                    this.clearBannerSelection();
                    return;
                }
                this.pendingBannerFile = file;
                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                    if (this.bannerPreview) {
                        this.bannerPreview.src = loadEvent.target?.result || this.bannerPreview.src;
                    }
                };
                reader.readAsDataURL(file);
            }

            clearBannerSelection() {
                this.pendingBannerFile = null;
                if (this.bannerInput) {
                    this.bannerInput.value = '';
                }
                this.resetBannerPreview();
            }

            resetBannerPreview() {
                if (this.bannerPreview) {
                    const fallback = this.editingProject?.bannerUrl || '/static/imagenes/coding-foto-ejemplo.jpg';
                    this.bannerPreview.src = fallback;
                }
            }

            collectFormValues() {
                const title = this.titleInput?.value.trim() || '';
                const description = this.descriptionInput?.value.trim() || '';
                const status = (this.statusSelect?.value || 'ACTIVE').toUpperCase();
                const duration = this.durationInput?.value.trim() || '';
                const language = this.languageInput?.value.trim() || '';
                const type = this.typeInput?.value.trim() || '';
                const teamMaxRaw = this.teamMaxInput?.value;
                const technologies = splitByComma(this.technologiesInput?.value || '');
                const objectives = splitByLine(this.objectivesInput?.value || '');
                const skillsNeeded = parseSkillsList(this.skillsInput?.value || '');
                const progressValue = clampProgress(this.progressInput?.value);

                let teamMax = null;
                if (teamMaxRaw !== undefined && teamMaxRaw !== null && teamMaxRaw !== '') {
                    const parsed = Number(teamMaxRaw);
                    if (Number.isFinite(parsed) && parsed > 0) {
                        teamMax = parsed;
                    }
                }

                return {
                    title,
                    description,
                    status: status || 'ACTIVE',
                    duration: duration || null,
                    language: language || null,
                    type: type || null,
                    teamMax,
                    technologies,
                    objectives,
                    skillsNeeded,
                    progress: progressValue,
                };
            }

            buildUpdatePayload(values) {
                return {
                    title: values.title,
                    description: values.description,
                    status: values.status || 'ACTIVE',
                    duration: values.duration,
                    language: values.language,
                    type: values.type,
                    teamMax: values.teamMax,
                    technologies: values.technologies,
                    objectives: values.objectives,
                    skillsNeeded: values.skillsNeeded,
                    progress: values.progress,
                };
            }

            async handleEditSubmit(event) {
                event.preventDefault();
                if (!this.editingProject?.id) {
                    TOAST('No se encontro el proyecto a editar.', 'error');
                    return;
                }
                const formValues = this.collectFormValues();
                if (!formValues.title || !formValues.description) {
                    TOAST('Completa al menos el nombre y la descripcion.', 'aviso');
                    return;
                }

                const payload = this.buildUpdatePayload(formValues);
                const formData = new FormData();
                formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
                if (this.pendingBannerFile) {
                    formData.append('banner', this.pendingBannerFile);
                }

                const projectId = this.editingProject.id;
                try {
                    const updatedProject = await window.apiClient.put(`/api/projects/${projectId}`, formData);
                    this.upsertProject(updatedProject, { focusCurrent: true });
                    TOAST('Proyecto actualizado correctamente.', 'exito');
                    this.closeEditModal();
                } catch (error) {
                    const message =
                        error?.data?.message || error?.data?.detail || error?.message || 'No se pudo actualizar el proyecto.';
                    TOAST(message, 'error');
                }
            }

            goToInterestedView() {
                const project = this.getCurrentProject();
                if (!project?.id) {
                    TOAST('Selecciona un proyecto antes de ver los interesados.', 'aviso');
                    return;
                }
                window.location.href = `/mis-proyectos/${project.id}/interesados`;
            }
        }

        window.MyProjectsManager = MyProjectsManager;
        return MyProjectsManager;
    };
})();