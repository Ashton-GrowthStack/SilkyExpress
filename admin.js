// ===== Configuration =====
// NOTE: Replace this with the actual Worker URL after deployment
const WORKER_URL = 'https://silkyexpress-catalog.rowanjeremiahn.workers.dev';

// ===== State =====
let currentPasscode = null;
let isEditMode = false;
let editingItemId = null;

// ===== Passcode =====
async function checkPasscode() {
    const input = document.getElementById('passcodeInput');
    const error = document.getElementById('passcodeError');
    const passcode = input.value.trim();

    if (!passcode) {
        error.textContent = 'Please enter a passcode';
        error.style.display = 'block';
        return;
    }

    error.style.display = 'none';

    try {
        const response = await fetch(`${WORKER_URL}/items`, {
            headers: { 'X-Admin-Passcode': passcode },
        });

        if (response.status === 401) {
            error.textContent = 'Incorrect passcode';
            error.style.display = 'block';
            return;
        }
        if (!response.ok) {
            error.textContent = 'Could not reach server, please try again';
            error.style.display = 'block';
            return;
        }

        currentPasscode = passcode;
        sessionStorage.setItem('sx_admin_passcode', passcode);
        unlockAdmin();
    } catch (err) {
        error.textContent = 'Could not reach server, please try again';
        error.style.display = 'block';
    }
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
        const response = await fetch(`${WORKER_URL}/items`, {
            headers: { 'X-Admin-Passcode': currentPasscode },
        });
        if (!response.ok) throw new Error('Failed to load catalog');

        catalogItems = await response.json() || [];

        // Category order = order categories first appear in catalog.json,
        // which is also the order of the filter buttons on the homepage
        categoryOrder = [...new Set(catalogItems.map(item => item.category))];
        savedCategoryOrder = [...categoryOrder];

        knownCategories = [...categoryOrder].sort((a, b) => a.localeCompare(b));
        renderCategoryOptions();
        renderCatalogList();
    } catch (err) {
        console.error('Error loading items:', err);
        itemsList.innerHTML = '<div class="empty-state">Failed to load products</div>';
    }
}

// ===== Category order (matches homepage filter button order) =====
let catalogItems = [];
let categoryOrder = [];
let savedCategoryOrder = [];

function renderCatalogList() {
    const itemsList = document.getElementById('itemsList');
    const itemsTotal = document.getElementById('itemsTotal');
    updateOrderBar();

    if (catalogItems.length === 0) {
        itemsList.innerHTML = '<div class="empty-state">No products yet. Add one below!</div>';
        if (itemsTotal) itemsTotal.textContent = '';
        return;
    }

    const groups = {};
    catalogItems.forEach(item => {
        (groups[item.category] = groups[item.category] || []).push(item);
    });

    if (itemsTotal) {
        itemsTotal.textContent = `${catalogItems.length} product${catalogItems.length === 1 ? '' : 's'} in ${categoryOrder.length} categor${categoryOrder.length === 1 ? 'y' : 'ies'}`;
    }

    itemsList.innerHTML = categoryOrder.map((category, index) => {
            const groupItems = [...groups[category]].sort((a, b) => a.name.localeCompare(b.name));
            return `
            <div class="category-group">
                <div class="category-heading">
                    <span class="category-title">
                        <span class="category-position" title="Position on the homepage (after All)">${index + 1}</span>
                        <span>${category}</span>
                        <span class="category-count">${groupItems.length}</span>
                    </span>
                    <span class="category-move">
                        <button type="button" class="category-move-btn" data-move="-1" data-index="${index}" title="Move up" ${index === 0 ? 'disabled' : ''}>&#9650;</button>
                        <button type="button" class="category-move-btn" data-move="1" data-index="${index}" title="Move down" ${index === categoryOrder.length - 1 ? 'disabled' : ''}>&#9660;</button>
                    </span>
                </div>
                ${groupItems.map(item => `
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
                `).join('')}
            </div>`;
    }).join('');
}

function isCategoryOrderChanged() {
    return categoryOrder.join('\n') !== savedCategoryOrder.join('\n');
}

function updateOrderBar() {
    const bar = document.getElementById('orderBar');
    if (bar) bar.style.display = isCategoryOrderChanged() ? '' : 'none';
}

// ▲ / ▼ buttons on each category heading
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-move-btn');
    if (!btn) return;
    const from = Number(btn.dataset.index);
    const to = from + Number(btn.dataset.move);
    if (to < 0 || to >= categoryOrder.length) return;
    [categoryOrder[from], categoryOrder[to]] = [categoryOrder[to], categoryOrder[from]];
    renderCatalogList();
});

function cancelCategoryOrder() {
    categoryOrder = [...savedCategoryOrder];
    renderCatalogList();
}

async function saveCategoryOrder() {
    const bar = document.getElementById('orderBar');
    bar.classList.add('loading');
    try {
        const response = await fetch(`${WORKER_URL}/reorder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Passcode': currentPasscode,
            },
            body: JSON.stringify({ categories: categoryOrder }),
        });

        if (response.status === 401) {
            lockAdmin();
            throw new Error('Passcode incorrect');
        }
        if (!response.ok) throw new Error('Failed to save order');

        await loadCatalogItems();
        showToast('Order saved — live in about a minute', 'success');
    } catch (err) {
        console.error('Error:', err);
        showToast(err.message || 'Failed to save order', 'error');
    } finally {
        bar.classList.remove('loading');
    }
}

// ===== File Input =====
function updateFileName() {
    const fileInput = document.getElementById('imageFile');
    const fileName = document.getElementById('fileName');
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 20 * 1024 * 1024) {
            showToast('File must be smaller than 20MB', 'error');
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
    clearExtraProducts();
    document.getElementById('addAnotherBtn').style.display = '';
    refreshCategoryHighlights();
}

// ===== Category quick-pick (existing categories as one-click options) =====
let knownCategories = [];

function renderCategoryOptions() {
    const datalist = document.getElementById('categoryOptions');
    if (datalist) {
        datalist.innerHTML = '';
        knownCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            datalist.appendChild(option);
        });
    }
    document.querySelectorAll('.category-chips').forEach(fillCategoryChips);
}

function fillCategoryChips(chips) {
    chips.innerHTML = '';
    knownCategories.forEach(cat => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'category-chip';
        chip.textContent = cat;
        chips.appendChild(chip);
    });
    highlightCategoryChip(chips);
}

function highlightCategoryChip(chips) {
    const input = chips.previousElementSibling;
    const value = input ? input.value.trim().toLowerCase() : '';
    chips.querySelectorAll('.category-chip').forEach(chip => {
        chip.classList.toggle('active', chip.textContent.toLowerCase() === value);
    });
}

function refreshCategoryHighlights() {
    document.querySelectorAll('.category-chips').forEach(highlightCategoryChip);
}

// Clicking a chip fills the category box right above it
document.addEventListener('click', (e) => {
    const chip = e.target.closest('.category-chip');
    if (!chip) return;
    const chips = chip.parentElement;
    chips.previousElementSibling.value = chip.textContent;
    highlightCategoryChip(chips);
});

// Typing an existing category name highlights its chip too
document.addEventListener('input', (e) => {
    const chips = e.target.nextElementSibling;
    if (chips && chips.classList.contains('category-chips')) highlightCategoryChip(chips);
});

// ===== Multiple products at once =====
function addProductPanel() {
    const container = document.getElementById('extraProducts');
    const panels = container.querySelectorAll('.extra-product');

    // Start with the previous panel's category (batches are often the same category)
    const lastCategoryInput = panels.length
        ? panels[panels.length - 1].querySelector('.extra-category')
        : document.getElementById('productCategory');

    const panel = document.createElement('div');
    panel.className = 'extra-product';
    panel.innerHTML = `
        <div class="extra-product-header">
            <span class="extra-product-title"></span>
            <button type="button" class="extra-product-remove" title="Remove this product">&times;</button>
        </div>
        <div class="form-group">
            <label>Product Image *</label>
            <div class="file-input-wrapper">
                <label class="file-input-label">
                    Click to select image
                    <span class="file-name"></span>
                    <input type="file" accept="image/*" class="extra-image">
                </label>
            </div>
        </div>
        <div class="form-group">
            <label>Product Name *</label>
            <input type="text" class="extra-name" placeholder="e.g., Premium Silk Fabric" autocomplete="off">
        </div>
        <div class="form-group">
            <label>Category *</label>
            <input type="text" class="extra-category" placeholder="e.g., Electronics, Textiles, Hardware" list="categoryOptions" autocomplete="off">
            <div class="category-chips"></div>
        </div>
    `;

    panel.querySelector('.extra-category').value = lastCategoryInput.value.trim();

    panel.querySelector('.extra-image').addEventListener('change', (e) => {
        const input = e.target;
        const label = panel.querySelector('.file-name');
        const file = input.files[0];
        if (file && file.size > 20 * 1024 * 1024) {
            showToast('File must be smaller than 20MB', 'error');
            input.value = '';
            label.textContent = '';
            return;
        }
        label.textContent = file ? `Selected: ${file.name}` : '';
    });

    panel.querySelector('.extra-product-remove').addEventListener('click', () => {
        panel.remove();
        updateProductPanels();
    });

    container.appendChild(panel);
    fillCategoryChips(panel.querySelector('.category-chips'));
    updateProductPanels();
    panel.querySelector('.extra-name').focus();
}

function clearExtraProducts() {
    document.getElementById('extraProducts').innerHTML = '';
    updateProductPanels();
}

function updateProductPanels() {
    const panels = document.querySelectorAll('#extraProducts .extra-product');
    panels.forEach((panel, i) => {
        panel.querySelector('.extra-product-title').textContent = `Product ${i + 2}`;
    });
    document.getElementById('firstProductTitle').style.display = panels.length ? '' : 'none';
    document.querySelector('#catalogForm .btn-submit').textContent =
        panels.length ? 'Save All Products' : 'Save Product';
}

function clearFirstPanel() {
    document.getElementById('productName').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('imageFile').value = '';
    document.getElementById('fileName').textContent = '';
    refreshCategoryHighlights();
}

// Gather every product in the form; returns null (and shows why) if any is incomplete
function collectNewProducts() {
    const panels = [...document.querySelectorAll('#extraProducts .extra-product')];
    const firstName = document.getElementById('productName').value.trim();
    const firstCategory = document.getElementById('productCategory').value.trim();
    const firstFile = document.getElementById('imageFile').files[0];
    const entries = [];

    // The first panel may be left blank when extra panels are in use
    if (firstName || firstCategory || firstFile || panels.length === 0) {
        entries.push({ name: firstName, category: firstCategory, file: firstFile, panel: null, label: 'Product 1' });
    }
    panels.forEach(panel => {
        entries.push({
            name: panel.querySelector('.extra-name').value.trim(),
            category: panel.querySelector('.extra-category').value.trim(),
            file: panel.querySelector('.extra-image').files[0],
            panel,
            label: panel.querySelector('.extra-product-title').textContent,
        });
    });

    const prefix = (entry) => (panels.length ? `${entry.label}: ` : '');
    for (const entry of entries) {
        if (!entry.name || !entry.category) {
            showToast(`${prefix(entry)}Please fill in all fields`, 'error');
            return null;
        }
        if (!entry.file) {
            showToast(`${prefix(entry)}Please select an image`, 'error');
            return null;
        }
    }
    return entries;
}

// Save one at a time - each save updates catalog.json, so they can't run in parallel
async function saveNewProducts(entries) {
    const submitBtn = document.querySelector('#catalogForm .btn-submit');
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entries.length > 1) submitBtn.textContent = `Saving ${i + 1} of ${entries.length}...`;
        try {
            await addCatalogItem(entry.name, entry.category, entry.file);
        } catch (err) {
            if (i === 0) throw err;
            throw new Error(`Saved ${i} of ${entries.length}. "${entry.name}" failed — it and the rest are still in the form.`);
        }
        // Take saved ones out of the form so a retry doesn't add them twice
        if (entry.panel) entry.panel.remove();
        else clearFirstPanel();
    }
}

async function submitCatalogForm(e) {
    e.preventDefault();

    if (!currentPasscode) {
        showToast('Passcode expired, please re-enter', 'error');
        lockAdmin();
        return;
    }

    const form = document.getElementById('catalogForm');

    if (isEditMode) {
        const name = document.getElementById('productName').value.trim();
        const category = document.getElementById('productCategory').value.trim();
        const fileInput = document.getElementById('imageFile');

        if (!name || !category) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        form.classList.add('loading');
        try {
            await editCatalogItem(editingItemId, name, category, fileInput.files[0]);
            resetForm();
            await loadCatalogItems();
            showToast('Saved — live in about a minute', 'success');
        } catch (err) {
            console.error('Error:', err);
            showToast(err.message || 'Failed to save', 'error');
        } finally {
            form.classList.remove('loading');
        }
        return;
    }

    const entries = collectNewProducts();
    if (!entries) return;

    form.classList.add('loading');
    try {
        await saveNewProducts(entries);
        resetForm();
        await loadCatalogItems();
        showToast(entries.length === 1
            ? 'Saved — live in about a minute'
            : `Saved ${entries.length} products — live in about a minute`, 'success');
    } catch (err) {
        console.error('Error:', err);
        await loadCatalogItems();
        showToast(err.message || 'Failed to save', 'error');
    } finally {
        form.classList.remove('loading');
        updateProductPanels();
    }
}

async function addCatalogItem(name, category, file) {
    const { base64, ext } = await prepareImageForUpload(file);

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
    clearExtraProducts();
    document.getElementById('addAnotherBtn').style.display = 'none';
    document.getElementById('formTitle').textContent = 'Edit Product';
    document.getElementById('productName').value = name;
    document.getElementById('productCategory').value = category;
    refreshCategoryHighlights();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function editCatalogItem(id, name, category, file) {
    const payload = {
        name,
        category,
    };

    if (file) {
        const { base64, ext } = await prepareImageForUpload(file);
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
// Shrink photos before upload so the homepage stays fast to load.
// Big images are resized to at most 1000px and saved as JPEG; small ones are left alone.
const UPLOAD_MAX_SIZE = 1000;
const UPLOAD_KEEP_UNDER_BYTES = 300 * 1024;

async function prepareImageForUpload(file) {
    const originalExt = file.name.split('.').pop().toLowerCase();
    const original = async () => ({ base64: await fileToBase64(file), ext: originalExt });

    // Leave animations and vector images as they are
    if (/^image\/(gif|svg\+xml)$/.test(file.type)) return original();

    let img;
    try {
        img = await loadImage(file);
    } catch (err) {
        return original();
    }

    const largest = Math.max(img.naturalWidth, img.naturalHeight);
    if (largest <= UPLOAD_MAX_SIZE && file.size <= UPLOAD_KEEP_UNDER_BYTES) return original();

    const scale = Math.min(1, UPLOAD_MAX_SIZE / largest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // transparent PNGs get a white background instead of black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const resized = canvas.toDataURL('image/jpeg', 0.82);
    // In the rare case resizing made it bigger, keep the original
    if (resized.length * 0.75 >= file.size) return original();
    return { base64: resized, ext: 'jpg' };
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
        img.src = url;
    });
}

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
