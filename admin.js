// ===== Configuration =====
// NOTE: Replace this with the actual Worker URL after deployment
const WORKER_URL = 'https://silkyexpress-catalog.YOUR-WORKER-SUBDOMAIN.workers.dev';

// ===== State =====
let currentPasscode = null;
let isEditMode = false;
let editingItemId = null;

// ===== Passcode =====
function checkPasscode() {
    const input = document.getElementById('passcodeInput');
    const error = document.getElementById('passcodeError');
    const passcode = input.value.trim();

    if (!passcode) {
        error.textContent = 'Please enter a passcode';
        error.style.display = 'block';
        return;
    }

    error.style.display = 'none';
    currentPasscode = passcode;
    sessionStorage.setItem('sx_admin_passcode', passcode);
    unlockAdmin();
}

function unlockAdmin() {
    document.getElementById('passcodeScreen').style.display = 'none';
    document.getElementById('adminContent').classList.add('unlocked');
    loadCatalogItems();
}

function lockAdmin() {
    sessionStorage.removeItem('sx_admin_passcode');
    currentPasscode = null;
    isEditMode = false;
    editingItemId = null;
    document.getElementById('passcodeInput').value = '';
    document.getElementById('passcodeScreen').style.display = 'block';
    document.getElementById('adminContent').classList.remove('unlocked');
}

// Check for cached passcode on page load
window.addEventListener('DOMContentLoaded', () => {
    const cached = sessionStorage.getItem('sx_admin_passcode');
    if (cached) {
        currentPasscode = cached;
        unlockAdmin();
    }
});

// ===== Catalog Items =====
async function loadCatalogItems() {
    const itemsList = document.getElementById('itemsList');
    itemsList.innerHTML = '<div class="empty-state">Loading...</div>';

    try {
        const response = await fetch('https://raw.githubusercontent.com/Ashton-GrowthStack/SilkyExpress/main/catalog.json');
        if (!response.ok) throw new Error('Failed to load catalog');

        const items = await response.json();
        if (!items || items.length === 0) {
            itemsList.innerHTML = '<div class="empty-state">No products yet. Add one below!</div>';
            return;
        }

        itemsList.innerHTML = items.map(item => `
            <div class="item-card">
                <img src="${item.image}" alt="${item.name}" loading="lazy">
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-category">${item.category}</div>
                </div>
                <div class="item-actions">
                    <button class="btn-small btn-edit" onclick="editItem('${item.id}', '${item.name}', '${item.category}')">Edit</button>
                    <button class="btn-small btn-delete" onclick="deleteItem('${item.id}', '${item.name}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading items:', err);
        itemsList.innerHTML = '<div class="empty-state">Failed to load products</div>';
    }
}

// ===== File Input =====
function updateFileName() {
    const fileInput = document.getElementById('imageFile');
    const fileName = document.getElementById('fileName');
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) {
            showToast('File must be smaller than 5MB', 'error');
            fileInput.value = '';
            fileName.textContent = '';
            return;
        }
        fileName.textContent = `Selected: ${file.name}`;
    } else {
        fileName.textContent = '';
    }
}

// ===== Form =====
function resetForm() {
    document.getElementById('catalogForm').reset();
    document.getElementById('fileName').textContent = '';
    isEditMode = false;
    editingItemId = null;
    document.getElementById('formTitle').textContent = 'Add New Product';
}

async function submitCatalogForm(e) {
    e.preventDefault();

    if (!currentPasscode) {
        showToast('Passcode expired, please re-enter', 'error');
        lockAdmin();
        return;
    }

    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value.trim();
    const fileInput = document.getElementById('imageFile');

    if (!name || !category) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    const form = document.getElementById('catalogForm');
    form.classList.add('loading');

    try {
        if (isEditMode) {
            await editCatalogItem(editingItemId, name, category, fileInput.files[0]);
        } else {
            if (!fileInput.files[0]) {
                showToast('Please select an image', 'error');
                form.classList.remove('loading');
                return;
            }
            await addCatalogItem(name, category, fileInput.files[0]);
        }

        resetForm();
        await loadCatalogItems();
        showToast('Saved — live in about a minute', 'success');
    } catch (err) {
        console.error('Error:', err);
        showToast(err.message || 'Failed to save', 'error');
    } finally {
        form.classList.remove('loading');
    }
}

async function addCatalogItem(name, category, file) {
    const base64 = await fileToBase64(file);
    const ext = file.name.split('.').pop().toLowerCase();

    const response = await fetch(`${WORKER_URL}/items`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Admin-Passcode': currentPasscode,
        },
        body: JSON.stringify({
            name,
            category,
            imageBase64: base64.split(',')[1],
            imageExt: ext,
        }),
    });

    if (response.status === 401) {
        lockAdmin();
        throw new Error('Passcode incorrect');
    }

    if (!response.ok) {
        throw new Error('Failed to add item');
    }
}

async function editItem(id, name, category) {
    isEditMode = true;
    editingItemId = id;
    document.getElementById('formTitle').textContent = 'Edit Product';
    document.getElementById('productName').value = name;
    document.getElementById('productCategory').value = category;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function editCatalogItem(id, name, category, file) {
    const payload = {
        name,
        category,
    };

    if (file) {
        const base64 = await fileToBase64(file);
        const ext = file.name.split('.').pop().toLowerCase();
        payload.imageBase64 = base64.split(',')[1];
        payload.imageExt = ext;
    }

    const response = await fetch(`${WORKER_URL}/items/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Admin-Passcode': currentPasscode,
        },
        body: JSON.stringify(payload),
    });

    if (response.status === 401) {
        lockAdmin();
        throw new Error('Passcode incorrect');
    }

    if (!response.ok) {
        throw new Error('Failed to edit item');
    }
}

async function deleteItem(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) {
        return;
    }

    const itemsList = document.getElementById('itemsList');
    itemsList.classList.add('loading');

    try {
        const response = await fetch(`${WORKER_URL}/items/${id}`, {
            method: 'DELETE',
            headers: {
                'X-Admin-Passcode': currentPasscode,
            },
        });

        if (response.status === 401) {
            lockAdmin();
            throw new Error('Passcode incorrect');
        }

        if (!response.ok) {
            throw new Error('Failed to delete item');
        }

        await loadCatalogItems();
        showToast('Deleted — changes live in about a minute', 'success');
    } catch (err) {
        console.error('Error:', err);
        showToast(err.message || 'Failed to delete', 'error');
    } finally {
        itemsList.classList.remove('loading');
    }
}

// ===== Utilities =====
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Allow Enter to unlock
document.getElementById('passcodeInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkPasscode();
});
