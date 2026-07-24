// Gallery toggle function
function toggleGallery(e) {
    e.preventDefault();
    const gallery = document.getElementById('gallery');
    const isVisible = gallery.style.display !== 'none';
    gallery.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        setTimeout(() => {
            gallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}

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

// Smooth scroll on page load if URL has hash
window.addEventListener('load', () => {
    if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
            setTimeout(() => {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }, 100);
        }
    }
});
