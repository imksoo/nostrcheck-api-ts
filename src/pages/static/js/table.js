const initTable = (tableId, data, objectName, authkey) => {
    console.log('Initializing table:', tableId)

    var data = JSON.parse(data)
    if (data.length == 0) {data = [{id: '-'}]} // dummy data for table creation

    $(tableId).bootstrapTable({
        data: data,
        uniqueId: 'id',
        pagination: true,
        search: true,
        searchClearButton: true,
        pageSize: 10,
        toolbar: tableId + '-toolbar',
        resizable: true,
        clickToSelect: true,
        showColumns: true,
        idField: 'id',
        detailView: true,
        detailFormatter: "detailFormatter",
        dataSidePagination: "server",

    })

    // Hide columns if hide is specified
    var columns = $(tableId).bootstrapTable('getOptions').columns[0];
    for (let column of columns) {
        if (column.class) {
            var classes = column.class.split(' ');
            classes.forEach(function(className) {
                if (className == 'hide') {
                    $(tableId).bootstrapTable('hideColumn', column.field);
                }
            });
        }
    }

    // Set field links for pubkey and filename
    let rows = $(tableId).bootstrapTable('getData', true);
    setFieldLinks(tableId, rows);


    // Buttons logic
    $(tableId).on('check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table', function () {
        $(tableId + '-button-disable').prop('disabled', !$(tableId).bootstrapTable('getSelections').length)
        $(tableId + '-button-enable').prop('disabled', !$(tableId).bootstrapTable('getSelections').length)
        $(tableId + '-button-show').prop('disabled', !$(tableId).bootstrapTable('getSelections').length)
        $(tableId + '-button-hide').prop('disabled', !$(tableId).bootstrapTable('getSelections').length)
        $(tableId + '-button-remove').prop('disabled', !$(tableId).bootstrapTable('getSelections').length)

        if ($(tableId).bootstrapTable('getSelections').length == 1) {
            $(tableId + '-button-admin').prop('disabled', false)
            $(tableId + '-button-edit').prop('disabled', false)
            $(tableId + '-button-password').prop('disabled', false)
        }
        else {
            $(tableId + '-button-add').prop('disabled', false)
            $(tableId + '-button-admin').prop('disabled', true)
            $(tableId + '-button-edit').prop('disabled', true)
            $(tableId + '-button-password').prop('disabled', true)
        }
    })

    // Add button
    $(tableId + '-button-add').click(function () {

        // Deselect all rows
        $(tableId).bootstrapTable('uncheckAll')

        // Create an empty row with same columns as table
        var row = {}
        $(tableId).bootstrapTable('getOptions').columns[0].forEach(element => {
            if (element.field != 'state'){
                row[element.field] = ''
            }
        });
        var columns = $(tableId).bootstrapTable('getOptions').columns[0];
        initEditModal(tableId,row,objectName, true, columns).then(async (editedRow) => {
            if (editedRow) {
                await modifyRecord(tableId, null, null, null, authkey, 'insert', editedRow)
                $(tableId).bootstrapTable('uncheckAll')
            }
        });
    }
    )

    // Admin, hide and show, enable and disable buttons
    initButton(tableId, '-button-admin', objectName, 'toggle admin permissions', 'allowed', authkey, null)
    initButton(tableId, '-button-hide', objectName, 'hide', 'visibility', authkey, 0)
    initButton(tableId, '-button-show', objectName, 'show', 'visibility', authkey, 1)
    initButton(tableId, '-button-disable', objectName, 'disable', 'active', authkey, 0)
    initButton(tableId, '-button-enable', objectName, 'enable', 'active', authkey, 1)
    initButton(tableId, '-button-remove', objectName, 'remove', '', authkey, null)
 
     // Edit button
     $(tableId + '-button-edit').click(function () {
        var row = $(tableId).bootstrapTable('getSelections')[0]

        // Update pubkey and filename fields to remove the links
        if (row.pubkey && row.pubkey.includes('<')) {row.pubkey = row.pubkey.split('>')[1].split('<')[0]}
        if (row.filename && row.filename.includes('<')) {row.filename = row.filename.split('>')[1].split('<')[0]}

        var columns = $(tableId).bootstrapTable('getOptions').columns[0];
        initEditModal(tableId,row,objectName,false,columns).then(async (editedRow) => {
            if (editedRow) {
                for (let field in editedRow) {
                    if (editedRow[field] != row[field]){
                        await modifyRecord(tableId, row.id, field, editedRow[field], authkey, 'modify')
                    }
                }
            }
        });
    })

    // Pasword button
    $(tableId + '-button-password').click(async function () {
        var ids = $.map($(tableId).bootstrapTable('getSelections'), function (row) {
        return row.id
        })

        if (await initConfirmModal(tableId,ids,'send new generated password to ',objectName)) {

            let url = "admin/resetpassword/";

            let data = {
                pubkey: $(tableId).bootstrapTable('getSelections')[0].hex,
            };

            fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "authorization": authkey
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => console.log(data))
            .catch((error) => {
                initAlertModal(tableId, error)
                console.error(error);
            });
        }
    })

}

function detailFormatter(index, row) {
var html = []
html.push('<div class="container-fluid ps-4">')
html.push('<h3><b>Details:</b></h3>')
$.each(row, function (key, value) {
    html.push('<p><b>' + key + ':</b> ' + value + '</p>')
})
html.push('</div>')
return html.join('')
}

function highlihtRow(tableId, row) {
    var index = $(tableId).bootstrapTable('getData').indexOf(row);
    var $row = $(tableId).find('tbody tr').eq(index);
    $row.removeClass('selected');
    $row.addClass('table-danger');
    setTimeout(function () {
        $row.removeClass('table-danger');
        $row.addClass('selected');
    }, 2000);
}

function initButton(tableId, buttonSuffix, objectName, modaltext, field, authkey, fieldValue) {
    $(tableId + buttonSuffix).click(async function () {
        var ids = $.map($(tableId).bootstrapTable('getSelections'), function (row) {
            // Update pubkey and filename fields to remove the links
            if (row.pubkey && row.pubkey.includes('<')) {row.pubkey = row.pubkey.split('>')[1].split('<')[0]}
            if (row.filename && row.filename.includes('<')) {row.filename = row.filename.split('>')[1].split('<')[0]}
            return row.id
        })

        if (await initConfirmModal(tableId, ids, modaltext, objectName)) {
            for (let id of ids) {
                if (modaltext === 'remove') {
                    modifyRecord(tableId, id, field, fieldValue, authkey, 'remove')
                } else {
                    modifyRecord(tableId, id, field, fieldValue, authkey, 'modify')
                }
            }
        }
    })
}

function modifyRecord(tableId, id, field, fieldValue, authkey, action = 'modify', row = null){

    if(row === null) {row = $(tableId).bootstrapTable('getRowByUniqueId', id)};
    if (action === 'modify') {url = "admin/updaterecord/"}
    if (action === 'remove') {url = "admin/deleterecord/"}
    if (action === 'insert') {url = "admin/insertrecord/"}

    console.log(action, url , id, field, fieldValue, authkey, row)

    if (field === "allowed") {
        fieldValue = $(tableId).bootstrapTable('getSelections')[0].allowed === 0 ? 1 : 0;
    }

    let data = {};
    if (action === 'remove' || action === 'modify') {
        
            data.table = tableId.split('-')[0].split('#')[1],
            data.field = field,
            data.value = fieldValue,
            data.id = row.id
        }
    
    if (action === 'insert') {
            data.table = tableId.split('-')[0].split('#')[1],
            data.row = row
    }

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "authorization": authkey
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(responseData => {

        if (responseData.status == "success") {
            if (action === 'remove') {
                $(tableId).bootstrapTable('removeByUniqueId', id);
            } else if (action === 'insert') {
                 // Add returned id to the row
                 row.id = +responseData.message;
           
                 // add a new row with modal form inputs
                 $(tableId).bootstrapTable('insertRow', {
                    index: 0,
                    row: data.row
                });
                setFieldLinks(tableId, [row]);
            }else {
                let updateData = {};
                updateData[field] = responseData.message;
                $(tableId).bootstrapTable('updateByUniqueId', {
                    id: id,
                    row: updateData
                });
                setFieldLinks(tableId, [row]);
            }
        } else {
            initAlertModal(tableId, responseData.message)
            highlihtRow(tableId, row)
        }
        })
    .catch((error) => {
        console.error(error);
        initAlertModal(tableId, responseData.message)
    });
}

function setFieldLinks(tableId, rows){

    console.log("setting field links", tableId, rows)

    // If the row field name is pubkey or filename show the data with a link

    rows.forEach(element => {
        console.log(element.id, element.pubkey, element.filename)

        if (element.pubkey) {
            $(tableId).bootstrapTable('updateCellByUniqueId', {
                id: element.id, 
                field: 'pubkey', 
                value: '<a href="https://nostrcheck.me/u/' + element.pubkey + '">' + element.pubkey + '</a>'
            });
            console.log("updating pubkey", element.pubkey)
        }

        if (element.filename) {
            $(tableId).bootstrapTable('updateCellByUniqueId', {
                id: element.id, 
                field: 'filename', 
                value: '<a href="/' + element.username + '/' + element.filename + '">' + element.filename + '</a>'
            });
            console.log("updating filename")
        }
    });
}