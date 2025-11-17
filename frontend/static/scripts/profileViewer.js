class ProfileViewer {
    constructor() {
        this.userId = null;
        this.profile = null;
        this.projectCard = document.getElementById('project-card');
        this.expandedCard = document.getElementById('expanded-card');
        this.closeExpandedBtn = document.getElementById('close-expanded');
        this.init();
    }

    async init() {
        // Get user ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.userId = parseInt(window.location.pathname.split('/').pop());

        if (!this.userId || isNaN(this.userId)) {
            console.error('Invalid user ID');
            return;
        }

        await this.loadProfile();
        this.setupEventListeners();
    }

    async loadProfile() {
        try {
            this.profile = await window.apiClient.get(`/api/users/${this.userId}/profile`);
            this.renderProfile();
        } catch (error) {
            console.error('Error loading profile:', error);
            this.showError('No se pudo cargar el perfil del usuario.');
        }
    }

    renderProfile() {
        if (!this.profile) {
            return;
        }

        const fullName = `${this.profile.firstName || ''} ${this.profile.lastName || ''}`.trim() || 'Usuario sin nombre';
        const status = (this.profile.status || 'DISPONIBLE').toString();

        // Update card title
        const cardTitle = this.projectCard?.querySelector('.card-title');
        if (cardTitle) {
            cardTitle.textContent = fullName;
        }

        // Update expanded title
        const expandedTitle = this.expandedCard?.querySelector('.expanded-title');
        if (expandedTitle) {
            expandedTitle.textContent = fullName;
        }

        // Update profile picture
        const pictureUrl = this.resolveAsset(this.profile.profilePictureUrl) || '/static/imagenes/profile-placeholder.svg';
        const cardImage = this.projectCard?.querySelector('.user-card-image');
        if (cardImage) {
            cardImage.style.backgroundImage = `url('${pictureUrl}')`;
        }

        // Update stats
        const cardStats = this.projectCard?.querySelectorAll('.stats-text');
        const expandedStats = this.expandedCard?.querySelectorAll('.stat-value');

        if (cardStats && cardStats.length >= 3) {
            cardStats[0].textContent = this.profile.age?.toString() || 'N/D';
            cardStats[1].textContent = this.profile.languages || 'N/D';
            cardStats[2].textContent = this.profile.specialization || 'N/D';
        }

        if (expandedStats && expandedStats.length >= 3) {
            expandedStats[0].textContent = this.profile.age?.toString() || 'N/D';
            expandedStats[1].textContent = this.profile.languages || 'N/D';
            expandedStats[2].textContent = this.profile.specialization || 'N/D';
        }

        // Render average rating
        const averageRating = this.profile.averageRating || 0;
        const starRating = this.generateStarRating(averageRating);
        const cardStarRating = this.projectCard?.querySelector('.star-rating');
        if (cardStarRating) {
            cardStarRating.innerHTML = starRating;
        }
        const expandedStarRating = this.expandedCard?.querySelector('#average-rating');
        if (expandedStarRating) {
            expandedStarRating.innerHTML = starRating;
        }

        // Update status badge
        const statusBadge = this.expandedCard?.querySelector('.status-badge');
        if (statusBadge) {
            const statusMap = {
                'DISPONIBLE': { text: 'Disponible', class: 'active' },
                'OCUPADO': { text: 'Ocupado', class: 'ocupado' },
                'INACTIVO': { text: 'Inactivo', class: 'inactive' }
            };
            const statusInfo = statusMap[status.toUpperCase()] || { text: 'Disponible', class: 'active' };
            statusBadge.textContent = statusInfo.text;
            statusBadge.className = `status-badge ${statusInfo.class}`;
        }

        // Update description/bio
        const cardDescription = this.projectCard?.querySelector('.card-description');
        if (cardDescription) {
            cardDescription.textContent = this.profile.bio || 'Este usuario aún no ha completado su biografía.';
        }

        const expandedDescription = this.expandedCard?.querySelector('.section-content');
        if (expandedDescription) {
            const formatted = (this.profile.bio || 'Este usuario aún no ha compartido información sobre sí mismo.').replace(/\n/g, '<br>');
            expandedDescription.innerHTML = formatted;
        }

        // Render skills
        this.renderSkills();

        // Render certifications
        this.renderCertifications();

        // Render interests
        this.renderInterests();

        // Render contact info
        this.renderContactInfo();

        // Update progress (mock data for now)
        const progressFill = this.expandedCard?.querySelector('.progress-fill');
        const progressText = this.expandedCard?.querySelector('.progress-text');
        if (progressFill && progressText) {
            const projectCount = this.profile.projectCount || 0;
            const progressPercent = Math.min(projectCount * 10, 100); // Simple calculation
            progressFill.style.width = `${progressPercent}%`;
            progressText.textContent = `${projectCount} proyecto${projectCount !== 1 ? 's' : ''} completado${projectCount !== 1 ? 's' : ''}`;
        }
    }

    renderSkills() {
        const grid = this.expandedCard?.querySelector('.tech-grid');
        if (!grid) return;

        const skills = Array.isArray(this.profile?.skills) ? this.profile.skills : [];
        grid.innerHTML = '';

        if (skills.length === 0) {
            grid.innerHTML = '<div class="empty-skills">No hay habilidades técnicas registradas</div>';
            return;
        }

        skills.forEach(skill => {
            const skillElement = document.createElement('div');
            skillElement.className = 'tech-item';

            const icon = document.createElement('span');
            icon.className = 'tech-icon-expanded';
            icon.textContent = this.getInitials(skill.name || skill);

            const details = document.createElement('div');
            details.className = 'tech-details';

            const name = document.createElement('span');
            name.className = 'tech-name';
            name.textContent = skill.name || skill;

            const level = document.createElement('span');
            level.className = 'tech-level';
            level.textContent = skill.level || '';

            details.appendChild(name);
            if (skill.level) {
                details.appendChild(level);
            }

            skillElement.appendChild(icon);
            skillElement.appendChild(details);
            grid.appendChild(skillElement);
        });
    }

    renderCertifications() {
        const list = this.expandedCard?.querySelector('.objectives-list');
        if (!list) return;

        const certifications = Array.isArray(this.profile?.certifications) ? this.profile.certifications : [];
        list.innerHTML = '';

        if (certifications.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'objective-item';
            emptyItem.textContent = 'No hay certificaciones registradas';
            list.appendChild(emptyItem);
            return;
        }

        certifications.forEach(cert => {
            const item = document.createElement('div');
            item.className = 'objective-item';
            item.textContent = cert;
            list.appendChild(item);
        });
    }

    renderInterests() {
        const grid = this.expandedCard?.querySelector('.skills-grid');
        if (!grid) return;

        const interests = Array.isArray(this.profile?.interests) ? this.profile.interests : [];
        grid.innerHTML = '';

        if (interests.length === 0) {
            const emptyBadge = document.createElement('div');
            emptyBadge.className = 'skill-badge';
            emptyBadge.textContent = 'No hay intereses registrados';
            grid.appendChild(emptyBadge);
            return;
        }

        interests.forEach(interest => {
            const badge = document.createElement('div');
            badge.className = 'skill-badge';
            badge.textContent = interest;
            grid.appendChild(badge);
        });
    }

    renderContactInfo() {
        const grid = this.expandedCard?.querySelector('.contact-grid');
        if (!grid) return;

        const contacts = [
            { label: 'Email', value: this.profile.email, icon: 'mdi--email-outline' },
            { label: 'Teléfono', value: this.profile.phone, icon: 'mdi--phone-outline' },
            { label: 'LinkedIn', value: this.profile.linkedin, icon: 'mdi--linkedin', isLink: true },
            { label: 'GitHub', value: this.profile.github, icon: 'mdi--github', isLink: true },
            { label: 'Portfolio', value: this.profile.portfolio, icon: 'mdi--web', isLink: true }
        ];

        grid.innerHTML = '';

        contacts.forEach(contact => {
            if (!contact.value) return;

            const item = document.createElement('div');
            item.className = 'contact-item';

            const icon = document.createElement('span');
            icon.className = `contact-icon ${contact.icon}`;

            const content = document.createElement('div');
            content.className = 'contact-content';

            const label = document.createElement('span');
            label.className = 'contact-label';
            label.textContent = contact.label;

            const value = document.createElement(contact.isLink ? 'a' : 'span');
            value.className = 'contact-value';
            value.textContent = contact.value;
            if (contact.isLink) {
                value.href = contact.value;
                value.target = '_blank';
                value.rel = 'noopener noreferrer';
            }

            content.appendChild(label);
            content.appendChild(value);

            item.appendChild(icon);
            item.appendChild(content);
            grid.appendChild(item);
        });

        if (grid.children.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'contact-item empty';
            emptyItem.textContent = 'No hay información de contacto disponible';
            grid.appendChild(emptyItem);
        }
    }

    generateStarRating(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        return '★'.repeat(fullStars) +
               (hasHalfStar ? '☆' : '') +
               '☆'.repeat(emptyStars);
    }

    getInitials(text) {
        if (!text) return 'N/A';
        return text.split(/\s+/).filter(Boolean).map(word => word[0]).join('').slice(0, 3).toUpperCase();
    }

    resolveAsset(path) {
        if (!path) return null;
        if (/^https?:\/\//i.test(path)) return path;
        const base = window.apiClient?.baseUrl ?? '';
        const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        return `${normalizedBase}${normalizedPath}`;
    }

    setupEventListeners() {
        // Expand card on click
        if (this.projectCard) {
            this.projectCard.addEventListener('click', () => {
                this.expandedCard?.classList.remove('hidden');
                this.expandedCard?.classList.add('visible');
            });
        }

        // Close expanded card
        if (this.closeExpandedBtn) {
            this.closeExpandedBtn.addEventListener('click', () => {
                this.expandedCard?.classList.remove('visible');
                this.expandedCard?.classList.add('hidden');
            });
        }

        // Close on outside click
        if (this.expandedCard) {
            this.expandedCard.addEventListener('click', (e) => {
                if (e.target === this.expandedCard) {
                    this.expandedCard.classList.remove('visible');
                    this.expandedCard.classList.add('hidden');
                }
            });
        }
    }

    showError(message) {
        const container = document.querySelector('.card-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <h2>Error</h2>
                    <p>${message}</p>
                    <button onclick="window.history.back()">Volver</button>
                </div>
            `;
        }
    }
}

// Initialize when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.profileViewer = new ProfileViewer();
});
