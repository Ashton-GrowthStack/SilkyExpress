// Gallery overlay functions
function openGallery() {
    const gallery = document.getElementById('gallery');
    gallery.classList.add('is-open');
    document.body.classList.add('gallery-open');
    gallery.setAttribute('aria-hidden', 'false');
    const closeBtn = gallery.querySelector('.gallery-close');
    if (closeBtn) closeBtn.focus();
    document.addEventListener('keydown', handleGalleryEscape);
}

function closeGallery() {
    const gallery = document.getElementById('gallery');
    gallery.classList.remove('is-open');
    document.body.classList.remove('gallery-open');
    gallery.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', handleGalleryEscape);
}

function handleGalleryEscape(e) {
    if (e.key === 'Escape') closeGallery();
}

function toggleGallery(e) {
    e.preventDefault();
    const gallery = document.getElementById('gallery');
    if (gallery.classList.contains('is-open')) {
        closeGallery();
    } else {
        openGallery();
    }
}

// Handle clicks on gallery backdrop
document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('gallery');
    if (gallery) {
        gallery.addEventListener('click', (e) => {
            if (e.target === gallery) closeGallery();
        });
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        if (this.classList.contains('gallery-tab')) return;
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Form handling
const consultationForm = document.getElementById('consultationForm');
if (consultationForm) {
    consultationForm.addEventListener('submit', function(e) {
        // Show success message before submitting
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.innerHTML = `
            <h3>Thank you for your inquiry!</h3>
            <p>We've received your consultation request. Our team will reach out within 24 hours.</p>
        `;
        successMessage.style.cssText = `
            background-color: #d4af37;
            color: #2c3e50;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
            text-align: center;
            font-weight: 600;
        `;

        consultationForm.parentElement.insertBefore(successMessage, consultationForm.nextSibling);

        // Let the form submit to Basin after showing message
        // (don't prevent default - let it naturally submit)
    });
}

// Handle page load with hash in URL
window.addEventListener('load', () => {
    if (window.location.hash) {
        if (window.location.hash === '#gallery') {
            setTimeout(() => {
                openGallery();
            }, 100);
        } else {
            const target = document.querySelector(window.location.hash);
            if (target) {
                setTimeout(() => {
                    target.scrollIntoView({
                        behavior: 'smooth'
                    });
                }, 100);
            }
        }
    }
});

// Load and render catalog
function loadCatalog() {
    const catalogGrid = document.querySelector('.catalog-grid');
    const catalogFilters = document.querySelector('.catalog-filters');

    if (!catalogGrid || !catalogFilters) return;

    fetch('catalog.json')
        .then(response => response.json())
        .then(items => {
            if (!items || items.length === 0) {
                catalogGrid.innerHTML = '<div class="catalog-empty">Catalog coming soon</div>';
                catalogFilters.innerHTML = '';
                return;
            }

            // Get unique categories
            const categories = [...new Set(items.map(item => item.category))];

            // Render filter buttons
            const filterHTML = '<button class="catalog-filter-btn active" data-category="all">All</button>' +
                categories.map(cat => `<button class="catalog-filter-btn" data-category="${cat}">${cat}</button>`).join('');
            catalogFilters.innerHTML = filterHTML;

            // Render catalog items
            renderCatalogItems(items, 'all');

            // Add filter button listeners
            document.querySelectorAll('.catalog-filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.catalog-filter-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    renderCatalogItems(items, e.target.dataset.category);
                });
            });
        })
        .catch(err => {
            console.error('Failed to load catalog:', err);
            catalogGrid.innerHTML = '<div class="catalog-empty">Failed to load catalog</div>';
        });
}

function renderCatalogItems(items, category) {
    const catalogGrid = document.querySelector('.catalog-grid');
    const filtered = category === 'all' ? items : items.filter(item => item.category === category);

    if (filtered.length === 0) {
        catalogGrid.innerHTML = '<div class="catalog-empty">No items in this category</div>';
        return;
    }

    catalogGrid.innerHTML = filtered.map(item => `
        <div class="catalog-item">
            <img src="${item.image}" alt="${item.name}" loading="lazy">
            <div class="catalog-item-name">${item.name}</div>
            <div class="catalog-item-category">${item.category}</div>
        </div>
    `).join('');
}

// Load catalog on page load
document.addEventListener('DOMContentLoaded', loadCatalog);
