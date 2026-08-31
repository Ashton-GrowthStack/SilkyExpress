/**
 * Silky Express Catalog Worker
 * Secure backend for managing catalog items with GitHub integration
 */

const REPO = 'Ashton-GrowthStack/SilkyExpress';
const BRANCH = 'main';
const CATALOG_PATH = 'catalog.json';
const CATALOG_FOLDER = 'catalog';

// CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': 'https://silkyexpress.com',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Passcode',
};

export default {
    async fetch(request, env, ctx) {
        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: CORS_HEADERS,
            });
        }

        // Add CORS headers to all responses
        // (plain object, not `new Headers(...)` — spreading a Headers
        // instance with {...headers} silently drops all its entries,
        // which was stripping Access-Control-Allow-Origin from every
        // real response and causing the browser to reject them as CORS
        // failures, even though the underlying GitHub write had succeeded)
        const responseHeaders = { ...CORS_HEADERS };

        try {
            // Validate passcode
            const passcode = request.headers.get('X-Admin-Passcode');
            if (passcode !== env.ADMIN_PASSCODE) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { ...responseHeaders, 'Content-Type': 'application/json' },
                });
            }

            const url = new URL(request.url);
            const path = url.pathname;

            // Route handling
            if (path === '/items' && request.method === 'GET') {
                return handleGetItems(env, responseHeaders);
            } else if (path === '/items' && request.method === 'POST') {
                return handleAddItem(request, env, responseHeaders);
            } else if (path.match(/^\/items\/[^/]+$/) && request.method === 'PUT') {
                const id = path.split('/')[2];
                return handleEditItem(id, request, env, responseHeaders);
            } else if (path.match(/^\/items\/[^/]+$/) && request.method === 'DELETE') {
                const id = path.split('/')[2];
                return handleDeleteItem(id, env, responseHeaders);
            } else {
                return new Response(JSON.stringify({ error: 'Not found' }), {
                    status: 404,
                    headers: { ...responseHeaders, 'Content-Type': 'application/json' },
                });
            }
        } catch (err) {
            console.error('Error:', err);
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { ...responseHeaders, 'Content-Type': 'application/json' },
            });
        }
    },
};

// Handlers
async function handleGetItems(env, headers) {
    try {
        // Read via the authenticated GitHub API (always current), not the
        // cached raw.githubusercontent.com CDN link (can lag several minutes
        // behind the real content, making just-saved changes look missing).
        const fileData = await fetchGitHubFile(env, CATALOG_PATH);
        const data = atob(fileData.content);
        return new Response(data, {
            status: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
        });
    }
}

async function handleAddItem(request, env, headers) {
    const body = await request.json();
    const { name, category, imageBase64, imageExt } = body;

    if (!name || !category || !imageBase64 || !imageExt) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
        });
    }

    try {
        const id = generateId();
        const imagePath = `${CATALOG_FOLDER}/${id}.${imageExt}`;

        // Upload image first
        await createGitHubFile(env, imagePath, imageBase64, `Catalog: add image ${id}`);

        // Then update catalog.json
        const catalogContent = await fetchCatalogWithSha(env);
        const items = JSON.parse(atob(catalogContent.content));
        items.push({
            id,
            name,
            category,
            image: imagePath,
        });

        const newContent = btoa(JSON.stringify(items, null, 2));
        await updateGitHubFile(env, CATALOG_PATH, newContent, catalogContent.sha, `Catalog: add ${name}`);

        return new Response(JSON.stringify({ success: true, id }), {
            status: 201,
            headers: { ...headers, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
        });
    }
}

async function handleEditItem(id, request, env, headers) {
    const body = await request.json();
    const { name, category, imageBase64, imageExt } = body;

    if (!name || !category) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
        });
    }

    try {
        const catalogContent = await fetchCatalogWithSha(env);
        const items = JSON.parse(atob(catalogContent.content));
        const itemIndex = items.findIndex(i => i.id === id);

        if (itemIndex === -1) {
            return new Response(JSON.stringify({ error: 'Item not found' }), {
                status: 404,
                headers: { ...headers, 'Content-Type': 'application/json' },
            });
        }

        // Update item
        const oldImagePath = items[itemIndex].image;
        items[itemIndex].name = name;
        items[itemIndex].category = category;

        // If new image provided, upload it
        if (imageBase64 && imageExt) {
            const newImagePath = `${CATALOG_FOLDER}/${id}.${imageExt}`;
            await createGitHubFile(env, newImagePath, imageBase64, `Catalog: update image ${id}`);
            items[itemIndex].image = newImagePath;
        }

        // Update catalog.json
        const newContent = btoa(JSON.stringify(items, null, 2));
        await updateGitHubFile(env, CATALOG_PATH, newContent, catalogContent.sha, `Catalog: edit ${name}`);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
        });
    }
}

async function handleDeleteItem(id, env, headers) {
    try {
        const catalogContent = await fetchCatalogWithSha(env);
        const items = JSON.parse(atob(catalogContent.content));
        const itemIndex = items.findIndex(i => i.id === id);

        if (itemIndex === -1) {
            return new Response(JSON.stringify({ error: 'Item not found' }), {
                status: 404,
                headers: { ...headers, 'Content-Type': 'application/json' },
            });
        }

        const itemName = items[itemIndex].name;
        const imagePath = items[itemIndex].image;

        // Remove from array
        items.splice(itemIndex, 1);

        // Update catalog.json
        const newContent = btoa(JSON.stringify(items, null, 2));
        await updateGitHubFile(env, CATALOG_PATH, newContent, catalogContent.sha, `Catalog: delete ${itemName}`);

        // Try to delete image (best-effort)
        try {
            const imageFile = await fetchGitHubFile(env, imagePath);
            if (imageFile) {
                await deleteGitHubFile(env, imagePath, imageFile.sha, `Catalog: remove image ${id}`);
            }
        } catch (imgErr) {
            console.warn('Could not delete image:', imgErr.message);
            // Continue anyway - the JSON update is what matters
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
        });
    }
}

// GitHub API Helpers
async function fetchCatalogWithSha(env) {
    return fetchGitHubFile(env, CATALOG_PATH);
}

async function fetchGitHubFile(env, path) {
    const response = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`,
        {
            headers: {
                'Authorization': `Bearer ${env.GITHUB_PAT}`,
                'User-Agent': 'Silky-Express-Catalog-Worker',
            },
        }
    );

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }

    return response.json();
}

async function createGitHubFile(env, path, base64Content, message) {
    const response = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${env.GITHUB_PAT}`,
                'User-Agent': 'Silky-Express-Catalog-Worker',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                content: base64Content,
                branch: BRANCH,
            }),
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`GitHub API error: ${error.message}`);
    }

    return response.json();
}

async function updateGitHubFile(env, path, base64Content, sha, message) {
    const response = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${env.GITHUB_PAT}`,
                'User-Agent': 'Silky-Express-Catalog-Worker',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                content: base64Content,
                sha,
                branch: BRANCH,
            }),
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`GitHub API error: ${error.message}`);
    }

    return response.json();
}

async function deleteGitHubFile(env, path, sha, message) {
    const response = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${path}`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${env.GITHUB_PAT}`,
                'User-Agent': 'Silky-Express-Catalog-Worker',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                sha,
                branch: BRANCH,
            }),
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`GitHub API error: ${error.message}`);
    }

    return response.json();
}

// Utilities
function generateId() {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
