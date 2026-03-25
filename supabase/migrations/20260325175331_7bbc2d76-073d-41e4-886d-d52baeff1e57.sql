
-- Step 1: For each duplicate phone (excluding '0' and ''), reassign registrations to the newest parent
DO $$
DECLARE
  rec RECORD;
  newest_id UUID;
  old_ids UUID[];
BEGIN
  FOR rec IN
    SELECT father_phone, 
           array_agg(id ORDER BY created_at DESC) AS ids
    FROM parent_accounts
    WHERE father_phone != '0' AND father_phone != ''
    GROUP BY father_phone
    HAVING COUNT(*) > 1
  LOOP
    newest_id := rec.ids[1];
    old_ids := rec.ids[2:];
    
    -- Reassign registrations
    UPDATE registrations SET parent_id = newest_id WHERE parent_id = ANY(old_ids);
    
    -- Reassign chat_conversations
    UPDATE chat_conversations SET parent_id = newest_id WHERE parent_id = ANY(old_ids);
    
    -- Delete old parent accounts
    DELETE FROM parent_accounts WHERE id = ANY(old_ids);
  END LOOP;
END;
$$;

-- Step 2: Also merge the "ايمن حمدي" duplicates with phone '0'
DO $$
DECLARE
  keep_id UUID;
  remove_id UUID;
BEGIN
  -- ايمن حمدي duplicates
  keep_id := 'c3ecc632-1475-4c66-8c4a-9cf2dfa8c0a2';
  remove_id := '60fda4ac-8306-40d8-99d8-c45589352477';
  UPDATE registrations SET parent_id = keep_id WHERE parent_id = remove_id;
  UPDATE chat_conversations SET parent_id = keep_id WHERE parent_id = remove_id;
  DELETE FROM parent_accounts WHERE id = remove_id;
  
  -- خالد محمود كامل duplicates
  keep_id := '5da01dd0-d202-4d8b-86d7-062c72738cc5';
  remove_id := 'b3a6785b-f610-4ec0-90c2-57500aedd48a';
  UPDATE registrations SET parent_id = keep_id WHERE parent_id = remove_id;
  UPDATE chat_conversations SET parent_id = keep_id WHERE parent_id = remove_id;
  DELETE FROM parent_accounts WHERE id = remove_id;
END;
$$;

-- Step 3: Add partial unique index to prevent future duplicates (excluding placeholder phones)
CREATE UNIQUE INDEX idx_parent_accounts_unique_phone 
ON parent_accounts (father_phone) 
WHERE father_phone != '0' AND father_phone != '';
