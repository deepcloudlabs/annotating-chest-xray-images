def extract_command_from_request(request, fields):
    command = {}
    for field in fields:
        if field in request.json:
            command[field] = request.json[field]
    return command
