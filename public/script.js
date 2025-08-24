document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const elements = {
    // Auth Elements
    signInLink: document.getElementById('signInLink'),
    dashboardLink: document.getElementById('dashboardLink'),
    logoutLink: document.getElementById('logoutLink'),
    userGreeting: document.getElementById('user-greeting'),
    
    // Navigation
    navToggle: document.getElementById('navToggle'),
    navLinks: document.getElementById('navLinks'),
    navLinksAll: document.querySelectorAll('.nav-link'),
    
    // Quote Modal
    quoteModal: document.getElementById('quoteModal'),
    closeQuote: document.getElementById('closeQuote'),
    smartQuoteForm: document.getElementById('smartQuoteForm'),
    formSteps: document.querySelectorAll('.form-step'),
    nextStepBtns: document.querySelectorAll('.next-step'),
    prevStepBtns: document.querySelectorAll('.prev-step'),
    detectLocation: document.getElementById('detectLocation'),
    
    // Utility Features
    liveTime: document.getElementById('live-time'),
    weatherDisplay: document.getElementById('weather-display'),
    checkLocation: document.getElementById('checkLocation'),
    installTime: document.getElementById('installTime'),
    
    // Design Explorer
    designTabs: document.querySelectorAll('.tab-button'),
    designContents: document.querySelectorAll('.design-tab'),
    configuratorForms: document.querySelectorAll('.configurator-form'),
    quickOrderButtons: document.querySelectorAll('.quick-order'),
    
    // New Features
    stickyBanner: document.getElementById('stickyBanner'),
    chatButton: document.getElementById('chatButton'),
    materialOptions: document.querySelectorAll('.material-option input'),
    arModal: document.getElementById('arModal'),
    closeArModal: document.getElementById('closeArModal'),
    arForm: document.getElementById('arDimensionForm')
  };

  // App State
  const state = {
    currentStep: 1,
    quoteData: { items: [] },
    userLocation: null,
    authToken: localStorage.getItem('token'),
    currentMaterial: 'fiberglass',
    currentTab: 'fixed'
  };

  // Initialize App
  function init() {
    AOS.init({ duration: 800, once: true });
    setupEventListeners();
    checkAuthState();
    updateLiveTime();
    fetchWeatherData();
    fetchReviews();
    setupQuoteModal();
    setupNavigation();
    setupDesignExplorer();
    setupConfigurator();
    setup3DVisualization();
    setupStickyBanner();
    setupChatButton();
    setupKeyboardNavigation();
  }

  // Event Listeners Setup
  function setupEventListeners() {
    // Auth Links
    if (elements.signInLink) {
      elements.signInLink.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthModal();
      });
    }

    if (elements.logoutLink) {
      elements.logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
      });
    }

    // Navigation Toggle
    if (elements.navToggle) {
      elements.navToggle.addEventListener('click', toggleMobileMenu);
    }

    // Quote Modal
    if (elements.closeQuote) {
      elements.closeQuote.addEventListener('click', closeQuoteModal);
      elements.quoteModal.addEventListener('click', (e) => {
        if (e.target === elements.quoteModal) closeQuoteModal();
      });
    }

    elements.nextStepBtns.forEach(btn => {
      btn.addEventListener('click', goToNextStep);
    });

    elements.prevStepBtns.forEach(btn => {
      btn.addEventListener('click', goToPrevStep);
    });

    // Location Detection
    if (elements.detectLocation) {
      elements.detectLocation.addEventListener('click', detectUserLocation);
    }

    if (elements.checkLocation) {
      elements.checkLocation.addEventListener('click', checkServiceAvailability);
    }

    // All "Get Quote" buttons
    document.querySelectorAll('[href="#quote"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openQuoteModal();
      });
    });

    // M-Pesa Payment
    const mpesaButton = document.getElementById('mpesapay');
    if (mpesaButton) {
      mpesaButton.addEventListener('click', () => {
        const mpesaModal = document.getElementById('mpesaModal');
        const mpesaTotal = document.getElementById('mpesaTotal');
        const mpesaDeposit = document.getElementById('mpesaDeposit');
        const totalCost = state.quoteData.totalCost || 5000;
        mpesaTotal.textContent = totalCost;
        mpesaDeposit.textContent = Math.round(totalCost * 0.5);
        mpesaModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      });
    }

    const closeMpesaModal = document.getElementById('closeMpesaModal');
    const cancelMpesa = document.getElementById('cancelMpesa');
    const confirmMpesa = document.getElementById('confirmMpesa');
    if (closeMpesaModal && cancelMpesa) {
      [closeMpesaModal, cancelMpesa].forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('mpesaModal').style.display = 'none';
          document.body.style.overflow = 'auto';
        });
      });
    }
    if (confirmMpesa) {
      confirmMpesa.addEventListener('click', async () => {
        const phone = document.getElementById('mpesaPhone').value;
        const amount = Math.round(state.quoteData.totalCost * 0.5) || 2500;
        const quoteId = state.quoteData.id || '12345';
        if (!phone || !/^\d{10}$/.test(phone)) {
          showNotification('Please enter a valid 10-digit phone number.', 'error');
          return;
        }
        try {
          const res = await fetch('/api/mpesa-pay', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.authToken || ''}`
            },
            body: JSON.stringify({ phone, amount, quoteId })
          });
          const data = await res.json();
          showNotification(data.message, data.success ? 'success' : 'error');
          if (data.success) {
            document.getElementById('mpesaModal').style.display = 'none';
            document.body.style.overflow = 'auto';
          }
        } catch (error) {
          console.error('M-Pesa payment error:', error);
          showNotification('Failed to initiate M-Pesa payment.', 'error');
        }
      });
    }

    // Sign-In Modal
    const closeSignInModal = document.getElementById('closeSignInModal');
    const signInForm = document.getElementById('signInForm');
    const showRegisterModal = document.getElementById('showRegisterModal');
    if (closeSignInModal) {
      closeSignInModal.addEventListener('click', () => {
        document.getElementById('signInModal').style.display = 'none';
        document.body.style.overflow = 'auto';
      });
      document.getElementById('signInModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('signInModal')) {
          document.getElementById('signInModal').style.display = 'none';
          document.body.style.overflow = 'auto';
        }
      });
    }
    if (signInForm) {
      signInForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signInEmail').value;
        const password = document.getElementById('signInPassword').value;
        try {
          const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await response.json();
          if (data.success) {
            localStorage.setItem('token', data.token);
            state.authToken = data.token;
            document.getElementById('signInModal').style.display = 'none';
            document.body.style.overflow = 'auto';
            fetchUserData();
            showNotification('Signed in successfully!', 'success');
          } else {
            showNotification('Invalid email or password.', 'error');
          }
        } catch (error) {
          console.error('Sign-in error:', error);
          showNotification('Error signing in.', 'error');
        }
      });
    }
    if (showRegisterModal) {
      showRegisterModal.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signInModal').style.display = 'none';
        document.getElementById('registerModal').style.display = 'flex';
      });
    }

    // Register Modal
    const closeRegisterModal = document.getElementById('closeRegisterModal');
    const registerForm = document.getElementById('registerForm');
    const showSignInModal = document.getElementById('showSignInModal');
    if (closeRegisterModal) {
      closeRegisterModal.addEventListener('click', () => {
        document.getElementById('registerModal').style.display = 'none';
        document.body.style.overflow = 'auto';
      });
      document.getElementById('registerModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('registerModal')) {
          document.getElementById('registerModal').style.display = 'none';
          document.body.style.overflow = 'auto';
        }
      });
    }
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        try {
          const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
          });
          const data = await response.json();
          if (data.success) {
            localStorage.setItem('token', data.token);
            state.authToken = data.token;
            document.getElementById('registerModal').style.display = 'none';
            document.body.style.overflow = 'auto';
            fetchUserData();
            showNotification('Account created successfully!', 'success');
          } else {
            showNotification('Error creating account: ' + data.message, 'error');
          }
        } catch (error) {
          console.error('Register error:', error);
          showNotification('Error creating account.', 'error');
        }
      });
    }
    if (showSignInModal) {
      showSignInModal.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('registerModal').style.display = 'none';
        document.getElementById('signInModal').style.display = 'flex';
      });
    }

    // Review Form
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
      reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rating = reviewForm.querySelector('select[name="rating"]').value;
        const comment = reviewForm.querySelector('textarea[name="comment"]').value;
        try {
          const response = await fetch('/api/reviews', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.authToken || ''}`
            },
            body: JSON.stringify({ rating, comment })
          });
          const data = await response.json();
          if (data.success) {
            showNotification('Review submitted! Awaiting approval.', 'success');
            reviewForm.reset();
            fetchReviews();
          } else {
            showNotification('Error submitting review.', 'error');
          }
        } catch (error) {
          console.error('Review submission error:', error);
          showNotification('Error submitting review.', 'error');
        }
      });
    }

    // AR Modal
    if (elements.closeArModal) {
      elements.closeArModal.addEventListener('click', closeArModal);
      elements.arModal.addEventListener('click', (e) => {
        if (e.target === elements.arModal) closeArModal();
      });
    }

    if (elements.arForm) {
      elements.arForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const width = document.getElementById('arWidth').value;
        const height = document.getElementById('arHeight').value;
        try {
          const response = await fetch('/api/quotes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.authToken || ''}`
            },
            body: JSON.stringify({
              windowCount: 1,
              measurements: [{ width: width / 100, height: height / 100 }],
              material: state.currentMaterial,
              type: state.currentTab,
              location: document.getElementById('installLocation')?.value || 'Nairobi',
              warranty: 'basic'
            })
          });
          const data = await response.json();
          if (data.success) {
            state.quoteData.totalCost = data.quote.totalCost;
            state.quoteData.id = data.quote.id;
            showNotification(`Quote generated! Total: KES ${data.quote.totalCost}`, 'success');
            closeArModal();
          } else {
            showNotification('Error generating quote.', 'error');
          }
        } catch (error) {
          console.error('Quote submission error:', error);
          showNotification('Error submitting measurements.', 'error');
        }
      });
    }
  }

  // Authentication Functions
  function checkAuthState() {
    if (state.authToken) {
      fetchUserData();
    } else {
      showUnauthenticatedUI();
    }
  }

  function fetchUserData() {
    fetch('/api/user', {
      headers: {
        'Authorization': `Bearer ${state.authToken}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Invalid token');
      }
      return response.json();
    })
    .then(user => {
      showAuthenticatedUI(user);
    })
    .catch(error => {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      state.authToken = null;
      showUnauthenticatedUI();
    });
  }

  function showAuthenticatedUI(user) {
    if (elements.signInLink) elements.signInLink.style.display = 'none';
    if (elements.dashboardLink) elements.dashboardLink.style.display = 'inline-block';
    if (elements.logoutLink) elements.logoutLink.style.display = 'inline-block';
    if (elements.userGreeting) {
      elements.userGreeting.textContent = `Hi, ${user.name}`;
      elements.userGreeting.style.display = 'inline-block';
    }

    if (!document.querySelector('.mobile-dashboard-link')) {
      const dashboardLink = document.createElement('li');
      dashboardLink.className = 'mobile-dashboard-link';
      dashboardLink.innerHTML = `<a href="/dashboard" class="nav-link">Dashboard</a>`;
      elements.navLinks.appendChild(dashboardLink);
    }
  }

  function showUnauthenticatedUI() {
    if (elements.signInLink) elements.signInLink.style.display = 'inline-block';
    if (elements.dashboardLink) elements.dashboardLink.style.display = 'none';
    if (elements.logoutLink) elements.logoutLink.style.display = 'none';
    if (elements.userGreeting) elements.userGreeting.style.display = 'none';

    const mobileDashboardLink = document.querySelector('.mobile-dashboard-link');
    if (mobileDashboardLink) {
      mobileDashboardLink.remove();
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    state.authToken = null;
    showUnauthenticatedUI();
    window.location.href = '/';
  }

  function showAuthModal() {
    const signInModal = document.getElementById('signInModal');
    if (signInModal) {
      signInModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      document.getElementById('signInEmail').focus();
    }
  }

  // Navigation Functions
  function toggleMobileMenu() {
    elements.navLinks.classList.toggle('active');
    elements.navToggle.classList.toggle('active');
  }

  function setupNavigation() {
    elements.navLinksAll.forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        if (targetSection) {
          const navHeight = document.querySelector('.nav').offsetHeight || 80;
          const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset - navHeight;
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
          elements.navLinksAll.forEach(l => l.classList.remove('active'));
          this.classList.add('active');
          if (elements.navLinks.classList.contains('active')) {
            toggleMobileMenu();
          }
          const tab = this.getAttribute('data-tab');
          if (tab) {
            activateDesignTab(tab);
          }
        } else {
          console.warn(`Section ${targetId} not found`);
        }
      });
    });
  }

  // Quote Modal Functions
  function setupQuoteModal() {
    if (elements.smartQuoteForm) {
      elements.smartQuoteForm.addEventListener('submit', handleQuoteSubmit);
    }
  }

  function openQuoteModal() {
    state.currentStep = 1;
    updateFormSteps();
    elements.quoteModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    elements.formSteps[0].querySelector('input').focus();
  }

  function closeQuoteModal() {
    elements.quoteModal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  function closeArModal() {
    elements.arModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    const stream = elements.arCamera?.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      elements.arCamera.srcObject = null;
    }
  }

  function goToNextStep() {
    if (validateCurrentStep()) {
      state.currentStep++;
      updateFormSteps();
      saveStepData();
    }
  }

  function goToPrevStep() {
    state.currentStep--;
    updateFormSteps();
  }

  function updateFormSteps() {
    elements.formSteps.forEach(step => {
      step.classList.remove('active');
      if (parseInt(step.dataset.step) === state.currentStep) {
        step.classList.add('active');
        step.querySelector('input, select')?.focus();
      }
    });
  }

  function validateCurrentStep() {
    if (state.currentStep === 2) {
      const width = document.getElementById('windowWidth').value;
      const height = document.getElementById('windowHeight').value;
      const count = document.getElementById('windowCount').value;
      if (!width || !height || !count || width < 0.5 || height < 0.5 || count < 1) {
        showNotification('Please enter valid window details.', 'error');
        return false;
      }
    } else if (state.currentStep === 3) {
      const location = document.getElementById('installLocation').value;
      const email = document.getElementById('quoteEmail').value;
      if (!location || !email.includes('@')) {
        showNotification('Please enter a valid address and email.', 'error');
        return false;
      }
    }
    return true;
  }

  function saveStepData() {
    if (state.currentStep === 2) {
      state.quoteData = {
        ...state.quoteData,
        propertyType: document.querySelector('input[name="propertyType"]:checked').value,
        windowWidth: document.getElementById('windowWidth').value,
        windowHeight: document.getElementById('windowHeight').value,
        windowCount: document.getElementById('windowCount').value,
        meshType: document.getElementById('meshType').value,
        materialType: document.getElementById('materialType').value
      };
    } else if (state.currentStep === 3) {
      state.quoteData = {
        ...state.quoteData,
        location: document.getElementById('installLocation').value,
        email: document.getElementById('quoteEmail').value
      };
    }
  }

  async function handleQuoteSubmit(e) {
    e.preventDefault();
    const formData = {
      windowCount: parseInt(state.quoteData.windowCount),
      measurements: [{ width: parseFloat(state.quoteData.windowWidth), height: parseFloat(state.quoteData.windowHeight) }],
      material: state.quoteData.materialType,
      type: state.quoteData.meshType,
      location: state.quoteData.location,
      warranty: 'basic',
      propertyType: state.quoteData.propertyType,
      items: state.quoteData.items
    };

    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': state.authToken ? `Bearer ${state.authToken}` : ''
        },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        state.quoteData.totalCost = data.quote.totalCost;
        state.quoteData.id = data.quote.id;
        showNotification(`Quote generated! Total: KES ${data.quote.totalCost}`, 'success');
        closeQuoteModal();
      } else {
        showNotification('Error generating quote: ' + data.message, 'error');
      }
    } catch (error) {
      console.error('Quote error:', error);
      showNotification('Error generating quote.', 'error');
    }
  }

  // Design Explorer Functions
  function setupDesignExplorer() {
    elements.designTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        activateDesignTab(tabId);
      });
    });
  }

  function activateDesignTab(tabId) {
    elements.designTabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    elements.designContents.forEach(c => c.classList.remove('active'));
    const selectedTab = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    const selectedContent = document.querySelector(`.design-tab[data-tab="${tabId}"]`);
    if (selectedTab && selectedContent) {
      selectedTab.classList.add('active');
      selectedTab.setAttribute('aria-selected', 'true');
      selectedContent.classList.add('active');
      state.currentTab = tabId;
    }
  }

  // Product Configurator
  function setupConfigurator() {
    elements.configuratorForms.forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = form.dataset.type;
        const quantity = form.querySelector(`#${type}-quantity`).value;
        const material = form.querySelector(`#${type}-material`).value;
        const width = form.querySelector(`#${type}-width`).value;
        const height = form.querySelector(`#${type}-height`).value;
        if (!quantity || !width || !height || quantity < 1 || width < 10 || height < 10) {
          showNotification('Please enter valid quantity and dimensions (min 10cm).', 'error');
          return;
        }
        const item = {
          type,
          quantity: parseInt(quantity),
          material,
          measurements: [{ width: parseFloat(width) / 100, height: parseFloat(height) / 100 }]
        };
        state.quoteData.items.push(item);
        try {
          const response = await fetch('/api/quotes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': state.authToken ? `Bearer ${state.authToken}` : ''
            },
            body: JSON.stringify({ items: [item], warranty: 'basic' })
          });
          const data = await response.json();
          if (data.success) {
            state.quoteData.totalCost = data.quote.totalCost;
            state.quoteData.id = data.quote.id;
            showNotification(`Added ${quantity} ${type} net(s) to your quote! Total: KES ${data.quote.totalCost}`, 'success');
            form.reset();
          } else {
            showNotification('Error adding to quote.', 'error');
          }
        } catch (error) {
          console.error('Configurator error:', error);
          showNotification('Error adding to quote.', 'error');
        }
      });
    });

    elements.quickOrderButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const type = btn.dataset.type;
        state.quoteData.items.push({ type, quantity: 1, material: 'fiberglass' });
        openQuoteModal();
      });
    });
  }

  // 3D Visualization
  function setup3DVisualization() {
    const container = document.getElementById('product3d');
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 2;
    controls.maxDistance = 10;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    let mesh;
    const loader = new THREE.GLTFLoader();
    // Placeholder: Replace with actual GLTF model path
    loader.load('Assets/models/window_frames.glb', (gltf) => {
      mesh = gltf.scene;
      scene.add(mesh);
      mesh.scale.set(1, 1, 1);
      mesh.position.set(0, 0, 0);
    }, undefined, (error) => {
      console.error('GLTF load error:', error);
      // Fallback to simple box
      const geometry = new THREE.BoxGeometry(2, 1, 0.1);
      const material = new THREE.MeshStandardMaterial({ color: 0x4ABDAC });
      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    });

    camera.position.set(0, 0, 5);

    const materials = {
      fiberglass: new THREE.MeshStandardMaterial({ color: 0x4ABDAC, roughness: 0.8 }),
      polyester: new THREE.MeshStandardMaterial({ color: 0x344532, roughness: 0.6 }),
      stainless: new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 })
    };

    elements.materialOptions.forEach(option => {
      option.addEventListener('change', () => {
        state.currentMaterial = option.value;
        if (mesh) {
          mesh.traverse(child => {
            if (child.isMesh) {
              child.material = materials[state.currentMaterial];
            }
          });
        }
      });
    });

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
  }

  // Sticky Banner
  function setupStickyBanner() {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        elements.stickyBanner.style.display = 'flex';
      } else {
        elements.stickyBanner.style.display = 'none';
      }
    });
  }

  // Live Chat Button (Placeholder)
  function setupChatButton() {
    if (elements.chatButton) {
      elements.chatButton.addEventListener('click', () => {
        showNotification('Live chat feature coming soon! Contact us at +254 723 544 097.', 'warning');
        // Implement actual chat integration (e.g., Tawk.to, Intercom) here
      });
    }
  }

  // Keyboard Navigation
  function setupKeyboardNavigation() {
    elements.designTabs.forEach((tab, index) => {
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activateDesignTab(tab.dataset.tab);
          tab.focus();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextTab = elements.designTabs[index + 1] || elements.designTabs[0];
          nextTab.focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prevTab = elements.designTabs[index - 1] || elements.designTabs[elements.designTabs.length - 1];
          prevTab.focus();
        }
      });
    });

    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          modal.style.display = 'none';
          document.body.style.overflow = 'auto';
          if (modal.id === 'arModal') closeArModal();
        }
      });
    });
  }

  // Location Functions
  async function detectUserLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async position => {
          state.userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          await reverseGeocode(state.userLocation);
        },
        error => {
          console.error('Geolocation error:', error);
          showNotification('Could not detect your location.', 'error');
        }
      );
    } else {
      showNotification('Geolocation not supported by your browser.', 'error');
    }
  }

  async function reverseGeocode(location) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}`);
      const data = await response.json();
      document.getElementById('installLocation').value = data.display_name || 'Location detected';
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      showNotification('Error detecting address.', 'error');
    }
  }

  async function checkServiceAvailability() {
    const location = document.getElementById('locationInput').value;
    if (!location) {
      showNotification('Please enter your location.', 'error');
      return;
    }

    try {
      const response = await fetch('/api/coverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: location })
      });
      const data = await response.json();
      if (data.success) {
        elements.installTime.textContent = `${data.installationDays} business days`;
      } else {
        showNotification('Error checking coverage: ' + data.message, 'error');
      }
    } catch (error) {
      console.error('Coverage check error:', error);
      showNotification('Error checking coverage.', 'error');
    }
  }

  // Utility Functions
  function updateLiveTime() {
    const now = new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    if (elements.liveTime) {
      elements.liveTime.textContent = now.toLocaleDateString('en-KE', options);
    }
    setTimeout(updateLiveTime, 60000);
  }

  async function fetchWeatherData() {
    try {
      const response = await fetch('/api/weather', { timeout: 5000 });
      const data = await response.json();
      if (data.success && elements.weatherDisplay) {
        elements.weatherDisplay.textContent = `${data.weather.location}: ${data.weather.temperature}°C, ${data.weather.condition}`;
      } else {
        throw new Error('Invalid weather data');
      }
    } catch (error) {
      console.error('Weather fetch error:', error);
      if (elements.weatherDisplay) {
        elements.weatherDisplay.textContent = 'Nairobi: 24°C, Sunny';
      }
      setTimeout(fetchWeatherData, 5 * 60 * 1000);
    }
  }

  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }

  // Fetch and Display Reviews
  async function fetchReviews() {
    try {
      const response = await fetch('/api/reviews');
      const data = await response.json();
      const reviewsContainer = document.getElementById('reviewsContainer');
      if (data.reviews && reviewsContainer) {
        reviewsContainer.innerHTML = data.reviews.map(review => `
          <div class="review-card">
            <div class="rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
            <p class="comment">${review.comment || 'No comment provided'}</p>
            <p class="customer">${review.user?.name || 'Anonymous'}</p>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Fetch reviews error:', error);
      showNotification('Error loading reviews.', 'error');
    }
  }

  // Initialize the app
  init();
});