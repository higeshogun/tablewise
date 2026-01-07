// This script is injected dynamically to find tables on the page
(function () {
    function cleanText(text) {
        if (!text) return '';
        text = text.trim();
        if (text.includes('"') || text.includes('\n') || text.includes('\t')) {
            text = '"' + text.replace(/"/g, '""') + '"';
        }
        return text;
    }

    // Heuristics to find a meaningful name for the table
    function getTableName(element) {
        // 1. aria-label or title
        if (element.getAttribute('aria-label')) return element.getAttribute('aria-label');
        if (element.getAttribute('title')) return element.getAttribute('title');

        // 2. Caption
        const caption = element.querySelector('caption');
        if (caption) return caption.innerText.trim();

        // 3. Previous Heading
        let prev = element.previousElementSibling;
        while (prev) {
            if (/^H[1-6]$/.test(prev.tagName)) {
                return prev.innerText.trim();
            }
            prev = prev.previousElementSibling;
            // Limit search distance
            if (!prev) break;
        }

        // 4. Parent ID
        if (element.id) return `Table #${element.id}`;

        return null; // No name found
    }

    function tableToCSV(table) {
        const rows = Array.from(table.querySelectorAll('tr'));
        return rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            return cells.map(cell => cleanText(cell.innerText)).join('\t');
        }).join('\n');
    }

    function agGridToCSV(gridRoot) {
        const headerCells = Array.from(gridRoot.querySelectorAll('.ag-header-cell-text'));
        const headerRow = headerCells.map(cell => cleanText(cell.innerText)).join('\t');

        const rowElements = Array.from(gridRoot.querySelectorAll('.ag-body-viewport .ag-row'));
        rowElements.sort((a, b) => {
            const idxA = parseInt(a.getAttribute('row-index') || '0', 10);
            const idxB = parseInt(b.getAttribute('row-index') || '0', 10);
            return idxA - idxB;
        });

        const csvRows = rowElements.map(row => {
            const cells = Array.from(row.querySelectorAll('.ag-cell'));
            return cells.map(cell => cleanText(cell.innerText)).join('\t');
        });

        return [headerRow, ...csvRows].join('\n');
    }

    const detectedTables = [];

    // --- Strategy 1: Standard Tables ---
    const htmlTables = Array.from(document.querySelectorAll('table'));
    htmlTables.forEach((table, index) => {
        const rows = table.rows.length;
        const cols = table.rows[0]?.cells?.length || 0;
        const cellCount = rows * cols;

        if (cellCount > 4) { // Ignore tiny tables
            const name = getTableName(table) || `Table ${index + 1}`;
            detectedTables.push({
                type: 'HTML Table',
                name: name,
                rows: rows,
                cols: cols,
                cellCount: cellCount,
                data: tableToCSV(table)
            });
        }
    });

    // --- Strategy 2: AG Grid ---
    // --- Strategy 2: AG Grid ---
    // Select both potential root elements
    let agGridCandidates = Array.from(document.querySelectorAll('.ag-root-wrapper, .ag-root'));

    // Filter out elements that are inside other candidates (avoid duplicates)
    agGridCandidates = agGridCandidates.filter((el, index, self) => {
        // Check if 'el' is a descendant of any OTHER element in 'self'
        return !self.some(other => other !== el && other.contains(el));
    });

    agGridCandidates.forEach((grid, index) => {
        const rows = grid.querySelectorAll('.ag-row').length;
        // ... (rest of logic)
        const cols = grid.querySelectorAll('.ag-header-cell').length;
        const cellCount = rows * cols;

        if (cellCount > 4) {
            // Try to find name on wrapper or nearby
            const name = getTableName(grid) || `AG Grid ${index + 1}`;
            detectedTables.push({
                type: 'AG Grid',
                name: name,
                rows: rows,
                cols: cols,
                cellCount: cellCount,
                data: agGridToCSV(grid)
            });
        }
    });

    // Sort by size (largest first)
    detectedTables.sort((a, b) => b.cellCount - a.cellCount);

    return {
        success: detectedTables.length > 0,
        tables: detectedTables,
        message: detectedTables.length > 0 ? `Found ${detectedTables.length} tables.` : 'No suitable tables found.'
    };
})();
