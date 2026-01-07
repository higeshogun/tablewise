const ClipboardUtils = {
    analyzeContent: (text) => {
        const lines = text.trim().split(/\r?\n/);
        const rowCount = lines.length;

        if (rowCount === 0) return { isTable: false };

        // Check for tabs or commas
        const firstLine = lines[0];
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;

        // Basic heuristic: if it has tabs or commas, it might be a table
        if (tabCount > 0 || commaCount > 0) {
            const delimiter = tabCount > commaCount ? '\t' : ',';
            const colCount = firstLine.split(delimiter).length;
            return {
                isTable: true,
                rows: rowCount,
                cols: colCount,
                delimiter: delimiter
            };
        }

        return { isTable: false };
    }
};
