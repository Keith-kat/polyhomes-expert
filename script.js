const state = { authToken: null, currentMaterial: 'fiberglass' };
const elements = {
  quoteForm: document.getElementById('quoteForm'),
  reviewForm: document.getElementById('reviewForm'),
  weatherDisplay: document.getElementById('weatherDisplay'),
  materialOptions: document.querySelectorAll('#material option')
};

async function init() {
  await fetchWeatherData();
  await fetchReviews();
  setup3DVisualization();
  elements.quoteForm.addEventListener('submit', handleQuoteSubmit);
  elements.reviewForm.addEventListener('submit', handleReviewSubmit);
}

async function handleQuoteSubmit(e) {
  e.preventDefault();
  try {
    const response = await fetch('https://expertpolyhomes.onrender.com/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.authToken}` },
      body: JSON.stringify({
        windowCount: document.getElementById('windowCount').value,
        dimensions: document.getElementById('dimensions').value,
        material: document.getElementById('material').value
      })
    });
    const data = await response.json();
    document.getElementById('quoteResult').innerText = data.success ? `Quote: KES ${data.quote.totalCost}` : 'Error generating quote';
  } catch (error) {
    document.getElementById('quoteResult').innerText = 'Error generating quote';
  }
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  try {
    const response = await fetch('https://expertpolyhomes.onrender.com/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.authToken}` },
      body: JSON.stringify({
        rating: document.getElementById('rating').value,
        comment: document.getElementById('comment').value
      })
    });
    const data = await response.json();
    document.getElementById('reviewList').innerText = data.success ? 'Review submitted' : 'Error submitting review';
  } catch (error) {
    document.getElementById('reviewList').innerText = 'Error submitting review';
  }
}

async function fetchWeatherData() {
  try {
    const response = await fetch('https://expertpolyhomes.onrender.com/api/weather');
    const data = await response.json();
    if (data.success) {
      elements.weatherDisplay.innerText = `Nairobi: ${data.data.main.temp}°C, ${data.data.weather[0].description}`;
    } else {
      elements.weatherDisplay.innerText = 'Weather unavailable';
    }
  } catch (error) {
    console.error('Weather fetch error:', error);
    elements.weatherDisplay.innerText = 'Weather unavailable';
  }
}

async function fetchReviews() {
  try {
    const response = await fetch('https://expertpolyhomes.onrender.com/api/reviews');
    const data = await response.json();
    if (data.success) {
      document.getElementById('reviewList').innerHTML = data.reviews.map(r => `<p>${r.comment} (${r.rating}/5)</p>`).join('');
    } else {
      document.getElementById('reviewList').innerText = 'No reviews available';
    }
  } catch (error) {
    console.error('Fetch reviews error:', error);
    document.getElementById('reviewList').innerText = 'Error loading reviews';
  }
}

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
  controls.minDistance = 2;
  controls.maxDistance = 10;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  let mesh;
  const loader = new THREE.GLTFLoader();
  loader.load('/polyhomes-expert/Assets/models/window_frames.glb', (gltf) => {
    mesh = gltf.scene;
    scene.add(mesh);
    mesh.scale.set(1, 1, 1);
    mesh.position.set(0, 0, 0);
  }, undefined, (error) => {
    console.error('GLTF load error:', error);
    showNotification('Error loading 3D model. Showing fallback.', 'error');
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

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerText = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', init);