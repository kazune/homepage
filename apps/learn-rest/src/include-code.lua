function CodeBlock(block)
  local source_path = block.attributes.include

  if source_path == nil then
    return nil
  end

  local source, open_error = io.open(source_path, "r")
  if source == nil then
    error("cannot include " .. source_path .. ": " .. open_error)
  end

  block.text = source:read("*a")
  source:close()
  block.attributes.include = nil

  return block
end
