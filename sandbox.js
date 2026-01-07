window.addEventListener('message', function (event) {
    const { command, context, data } = event.data;

    if (command === 'filter') {
        try {
            // "context" is the code provided by LLM (function body)
            // "data" is the array of row objects

            // We expect the LLM to return a function body that takes 'row' and returns boolean
            // OR a full function filtering 'rows'

            // Safe wrapper: We create a Function from the string
            // The LLM output usually is: "return row.price > 100" or "rows.filter(r => ...)"

            // Let's assume we ask LLM to provide the FUNCTION BODY for a filter operation on a single 'row'
            // e.g. "return parseFloat(row['Price']) > 100;"

            // Construct the filter function
            const filterFn = new Function('row', context);

            const filtered = data.filter(row => {
                try {
                    return filterFn(row);
                } catch (e) {
                    return false;
                }
            });

            event.source.postMessage({ success: true, result: filtered }, event.origin);
        } catch (error) {
            event.source.postMessage({ success: false, error: error.message }, event.origin);
        }
    }
});
