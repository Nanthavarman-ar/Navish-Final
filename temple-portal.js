// Temple Darshan Portal JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Mobile Navigation Toggle
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    navToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });

    // Smooth Scrolling for Navigation Links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }

            // Close mobile menu if open
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });

    // Temple Card Click Handler
    const templeCards = document.querySelectorAll('.temple-card');
    templeCards.forEach(card => {
        card.addEventListener('click', function() {
            const templeName = this.dataset.temple;
            showTempleDetails(templeName);
        });
    });

    // Live Darshan Button Handler
    const liveButtons = document.querySelectorAll('.btn-live');
    liveButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent temple card click
            const templeCard = this.closest('.temple-card');
            const templeName = templeCard.dataset.temple;
            startLiveDarshan(templeName);
        });
    });

    // Booking Form Handler
    const bookingForm = document.querySelector('.booking-form');
    if (bookingForm) {
        bookingForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleBooking(this);
        });
    }

    // Contact Form Handler
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleContact(this);
        });
    }

    // Hero Buttons
    const heroButtons = document.querySelectorAll('.hero-buttons .btn');
    heroButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.classList.contains('btn-primary')) {
                document.getElementById('temples').scrollIntoView({ behavior: 'smooth' });
            } else {
                document.getElementById('temples').scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Intersection Observer for Animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.temple-card, .feature-item, .contact-item');
    animateElements.forEach(el => observer.observe(el));

    // Initialize counters
    initializeCounters();

    // Initialize live darshan updates
    initializeLiveDarshan();
});

// Temple Details Modal
function showTempleDetails(templeName) {
    const templeData = getTempleData(templeName);

    const modal = document.createElement('div');
    modal.className = 'temple-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${templeData.name}</h2>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="modal-image">
                    <img src="${templeData.image}" alt="${templeData.name}">
                </div>
                <div class="modal-info">
                    <h3>${templeData.location}</h3>
                    <p>${templeData.description}</p>
                    <div class="temple-details">
                        <div class="detail-item">
                            <i class="fas fa-clock"></i>
                            <span>Timings: ${templeData.timings}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${templeData.fullLocation}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-info-circle"></i>
                            <span>${templeData.significance}</span>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-primary" onclick="startLiveDarshan('${templeName}')">
                            <i class="fas fa-video"></i> Live Darshan
                        </button>
                        <button class="btn btn-secondary" onclick="bookDarshan('${templeName}')">
                            <i class="fas fa-calendar-alt"></i> Book Darshan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close modal functionality
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });

    // Add modal styles
    if (!document.querySelector('#modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'modal-styles';
        styles.textContent = `
            .temple-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                animation: fadeIn 0.3s ease;
            }
            .modal-content {
                background: white;
                border-radius: 15px;
                max-width: 800px;
                max-height: 90vh;
                overflow-y: auto;
                animation: slideIn 0.3s ease;
            }
            .modal-header {
                padding: 1.5rem;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .modal-header h2 {
                margin: 0;
                color: #333;
            }
            .close-modal {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #666;
            }
            .modal-body {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1.5rem;
                padding: 1.5rem;
            }
            .modal-image img {
                width: 100%;
                border-radius: 10px;
            }
            .temple-details {
                margin: 1rem 0;
            }
            .detail-item {
                display: flex;
                align-items: center;
                margin-bottom: 0.5rem;
            }
            .detail-item i {
                margin-right: 0.5rem;
                color: #667eea;
                width: 20px;
            }
            .modal-actions {
                display: flex;
                gap: 1rem;
                margin-top: 1rem;
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: translateY(-50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @media (max-width: 768px) {
                .modal-body {
                    grid-template-columns: 1fr;
                }
                .modal-actions {
                    flex-direction: column;
                }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Temple Data
function getTempleData(templeName) {
    const temples = {
        somnath: {
            name: 'Somnath Temple',
            location: 'Gujarat, India',
            fullLocation: 'Somnath, Prabhas Patan, Veraval, Gujarat 362268',
            image: 'https://images.unsplash.com/photo-1580500550469-4b20ee8ae07b?w=400&h=300&fit=crop',
            description: 'One of the twelve Jyotirlinga shrines of Shiva, located at the shore of the Arabian ocean.',
            timings: '6:00 AM - 9:00 PM',
            significance: 'First among the twelve Jyotirlinga shrines of Shiva'
        },
        dwarkadhish: {
            name: 'Dwarkadhish Temple',
            location: 'Gujarat, India',
            fullLocation: 'Dwarka, Gujarat 361335',
            image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
            description: 'Dedicated to Lord Krishna, the king of Dwarka.',
            timings: '6:30 AM - 8:30 PM',
            significance: 'One of the Char Dham pilgrimage sites'
        },
        ambaji: {
            name: 'Ambaji Temple',
            location: 'Gujarat, India',
            fullLocation: 'Ambaji, Banaskantha, Gujarat 385110',
            image: 'https://images.unsplash.com/photo-1606836573950-710f8d5c7cc4?w=400&h=300&fit=crop',
            description: 'Temple dedicated to Goddess Amba, one of the 51 Shakti Peethas.',
            timings: '7:00 AM - 7:30 PM',
            significance: 'One of the 51 Shakti Peethas'
        },
        pavagadh: {
            name: 'Pavagadh Temple',
            location: 'Gujarat, India',
            fullLocation: 'Pavagadh, Panchmahal, Gujarat 389360',
            image: 'https://images.unsplash.com/photo-1580500550469-4b20ee8ae07b?w=400&h=300&fit=crop',
            description: 'Hill temple dedicated to Goddess Mahakali.',
            timings: '5:00 AM - 8:00 PM',
            significance: 'UNESCO World Heritage Site'
        },
        akshardham: {
            name: 'Akshardham Temple',
            location: 'Gujarat, India',
            fullLocation: 'Gandhinagar, Gujarat 382007',
            image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
            description: 'Magnificent temple complex showcasing Indian culture and architecture.',
            timings: '9:30 AM - 7:30 PM',
            significance: 'Cultural and spiritual center'
        },
        kedarnath: {
            name: 'Kedarnath Temple',
            location: 'Uttarakhand, India',
            fullLocation: 'Kedarnath, Rudraprayag, Uttarakhand 246445',
            image: 'https://images.unsplash.com/photo-1606836573950-710f8d5c7cc4?w=400&h=300&fit=crop',
            description: 'One of the twelve Jyotirlingas of Lord Shiva.',
            timings: '4:00 AM - 8:00 PM',
            significance: 'One of the Char Dham pilgrimage sites'
        }
    };

    return temples[templeName] || temples.somnath;
}

// Live Darshan Functions
function startLiveDarshan(templeName) {
    const templeData = getTempleData(templeName);

    // Create live darshan modal
    const liveModal = document.createElement('div');
    liveModal.className = 'live-darshan-modal';
    liveModal.innerHTML = `
        <div class="live-modal-content">
            <div class="live-modal-header">
                <h2><i class="fas fa-video"></i> Live Darshan - ${templeData.name}</h2>
                <button class="close-live-modal">&times;</button>
            </div>
            <div class="live-modal-body">
                <div class="live-video-player">
                    <div class="video-placeholder">
                        <i class="fas fa-play-circle"></i>
                        <h3>Live Stream</h3>
                        <p>Connecting to ${templeData.name}...</p>
                        <div class="live-indicator">
                            <span class="live-dot"></span>
                            <span>LIVE</span>
                        </div>
                    </div>
                </div>
                <div class="live-info">
                    <h4>Current Program</h4>
                    <p>Morning Aarti - 6:00 AM to 7:00 AM</p>
                    <div class="live-stats">
                        <div class="stat">
                            <i class="fas fa-eye"></i>
                            <span>1,234 viewers</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-clock"></i>
                            <span>Started 30 min ago</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(liveModal);

    // Close modal functionality
    const closeBtn = liveModal.querySelector('.close-live-modal');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(liveModal);
    });

    liveModal.addEventListener('click', (e) => {
        if (e.target === liveModal) {
            document.body.removeChild(liveModal);
        }
    });

    // Add live modal styles
    if (!document.querySelector('#live-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'live-modal-styles';
        styles.textContent = `
            .live-darshan-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            }
            .live-modal-content {
                background: #1a1a1a;
                color: white;
                border-radius: 15px;
                width: 90%;
                max-width: 1000px;
                max-height: 90vh;
                overflow: hidden;
            }
            .live-modal-header {
                padding: 1rem 1.5rem;
                border-bottom: 1px solid #333;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .close-live-modal {
                background: none;
                border: none;
                color: white;
                font-size: 1.5rem;
                cursor: pointer;
            }
            .live-modal-body {
                display: grid;
                grid-template-columns: 2fr 1fr;
                gap: 1rem;
                padding: 1rem;
            }
            .live-video-player {
                background: #000;
                border-radius: 10px;
                aspect-ratio: 16/9;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .video-placeholder {
                text-align: center;
                color: #666;
            }
            .video-placeholder i {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            .live-indicator {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                margin-top: 1rem;
            }
            .live-dot {
                width: 8px;
                height: 8px;
                background: #ff4757;
                border-radius: 50%;
                animation: pulse 1s infinite;
            }
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            .live-info {
                padding: 1rem;
            }
            .live-stats {
                margin-top: 1rem;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            .stat {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.9rem;
            }
            @media (max-width: 768px) {
                .live-modal-body {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Booking Functions
function bookDarshan(templeName) {
    // Close temple modal if open
    const existingModal = document.querySelector('.temple-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Scroll to booking section
    document.getElementById('bookings').scrollIntoView({ behavior: 'smooth' });

    // Pre-fill temple selection
    const templeSelect = document.getElementById('temple-select');
    if (templeSelect) {
        templeSelect.value = templeName;
    }
}

function handleBooking(form) {
    const formData = new FormData(form);
    const bookingData = Object.fromEntries(formData);

    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Booking...';
    submitBtn.disabled = true;

    // Simulate API call
    setTimeout(() => {
        // Show success message
        showNotification('Booking successful! You will receive a confirmation email shortly.', 'success');

        // Reset form
        form.reset();
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }, 2000);
}

// Contact Form Handler
function handleContact(form) {
    const formData = new FormData(form);

    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;

    // Simulate API call
    setTimeout(() => {
        // Show success message
        showNotification('Message sent successfully! We will get back to you soon.', 'success');

        // Reset form
        form.reset();
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }, 1500);
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;

    document.body.appendChild(notification);

    // Close notification
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(notification);
    });

    // Auto close after 5 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 5000);

    // Add notification styles
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                z-index: 3000;
                animation: slideInRight 0.3s ease;
            }
            .notification-success {
                border-left: 4px solid #2ecc71;
            }
            .notification-error {
                border-left: 4px solid #e74c3c;
            }
            .notification-info {
                border-left: 4px solid #3498db;
            }
            .notification-content {
                padding: 1rem 1.5rem;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
            }
            .notification-close {
                background: none;
                border: none;
                font-size: 1.2rem;
                cursor: pointer;
                color: #666;
            }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Counter Animation
function initializeCounters() {
    const counters = document.querySelectorAll('.stat-number');

    const counterObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = parseInt(counter.textContent.replace(/\D/g, ''));
                const suffix = counter.textContent.replace(/\d/g, '');
                let current = 0;
                const increment = target / 50;

                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        current = target;
                        clearInterval(timer);
                    }
                    counter.textContent = Math.floor(current) + suffix;
                }, 30);

                counterObserver.unobserve(counter);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => counterObserver.observe(counter));
}

// Live Darshan Updates
function initializeLiveDarshan() {
    // Update upcoming darshans every minute
    setInterval(updateUpcomingDarshans, 60000);
}

function updateUpcomingDarshans() {
    const upcomingItems = document.querySelectorAll('.upcoming-item');

    upcomingItems.forEach((item, index) => {
        const timeElement = item.querySelector('.time');
        const eventElement = item.querySelector('.event');

        if (timeElement && eventElement) {
            // Simulate dynamic updates
            const events = ['Morning Aarti', 'Mangala Aarti', 'Midday Darshan', 'Evening Aarti', 'Night Darshan'];
            const randomEvent = events[Math.floor(Math.random() * events.length)];

            eventElement.textContent = randomEvent;
        }
    });
}

// Add CSS animations
const animationStyles = document.createElement('style');
animationStyles.textContent = `
    .animate-in {
        animation: fadeInUp 0.6s ease forwards;
    }

    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .nav-menu.active {
        display: flex;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 1rem;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }

    .nav-toggle.active span:nth-child(1) {
        transform: rotate(45deg) translate(5px, 5px);
    }

    .nav-toggle.active span:nth-child(2) {
        opacity: 0;
    }

    .nav-toggle.active span:nth-child(3) {
        transform: rotate(-45deg) translate(7px, -6px);
    }
`;
document.head.appendChild(animationStyles);
