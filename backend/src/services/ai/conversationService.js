/**
 * AI会话管理服务 - Supabase版
 * 管理用户与AI的对话会话
 */
import supabase from '../../utils/supabaseToPrismaAdapter.js'
import logger from '../../utils/logger.js'

/**
 * 创建新会话
 */
export async function createConversation(userId, type, title = null, context = {}) {
  try {
    // 先获取最大ID，解决序列不同步问题
    const { data: maxIdResult } = await supabase
      .from('ai_conversations')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
    
    const nextId = (maxIdResult && maxIdResult[0]?.id) ? maxIdResult[0].id + 1 : 1
    const now = new Date().toISOString()
    
    const { data: conversation, error } = await supabase
      .from('ai_conversations')
      .insert({
        id: nextId,
        user_id: parseInt(userId),
        type,
        title: title || '对话 - ' + new Date().toLocaleString('zh-CN'),
        context: JSON.stringify(context),
        status: 'active',
        created_at: now,
        updated_at: now
      })
      .select()
      .single()
    
    if (error) throw error
    
    logger.info('创建AI会话: userId=' + userId + ', type=' + type + ', id=' + conversation.id)
    return conversation
  } catch (error) {
    logger.error('创建会话失败:', error)
    throw error
  }
}

/**
 * 获取用户的会话列表
 */
export async function getConversations(userId, type = null, options = {}) {
  try {
    const { page = 1, pageSize = 20 } = options
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    
    let query = supabase
      .from('ai_conversations')
      .select('*', { count: 'exact' })
      .eq('user_id', parseInt(userId))
      .eq('status', 'active')
    
    if (type) {
      query = query.eq('type', type)
    }
    
    const { data: conversations, count, error } = await query
      .order('updated_at', { ascending: false })
      .range(from, to)
    
    if (error) throw error
    
    const conversationIds = (conversations || []).map(c => c.id)
    let lastMessages = {}
    
    if (conversationIds.length > 0) {
      const { data: messages } = await supabase
        .from('ai_messages')
        .select('conversation_id, content, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
      
      messages?.forEach(m => {
        if (!lastMessages[m.conversation_id]) {
          lastMessages[m.conversation_id] = m
        }
      })
    }
    
    const list = (conversations || []).map(c => ({
      ...c,
      lastMessage: lastMessages[c.id] || null
    }))
    
    return {
      list,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    }
  } catch (error) {
    logger.error('获取会话列表失败:', error)
    throw error
  }
}

/**
 * 获取会话详情
 */
export async function getConversation(conversationId, userId = null) {
  try {
    let query = supabase
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
    
    if (userId) {
      query = query.eq('user_id', parseInt(userId))
    }
    
    const { data: conversation, error } = await query.single()
    
    if (error) throw error
    return conversation
  } catch (error) {
    logger.error('获取会话详情失败:', error)
    throw error
  }
}

/**
 * 删除会话
 */
export async function deleteConversation(conversationId, userId) {
  try {
    const { error } = await supabase
      .from('ai_conversations')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', parseInt(userId))
    
    if (error) throw error
    return true
  } catch (error) {
    logger.error('删除会话失败:', error)
    throw error
  }
}

/**
 * 添加消息到会话
 */
export async function addMessage(conversationId, role, content, metadata = {}) {
  try {
    // 先获取最大ID，解决序列不同步问题
    const { data: maxIdResult } = await supabase
      .from('ai_messages')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
    
    const nextId = (maxIdResult && maxIdResult[0]?.id) ? maxIdResult[0].id + 1 : 1
    
    const { data: message, error } = await supabase
      .from('ai_messages')
      .insert({
        id: nextId,
        conversation_id: conversationId,
        role,
        content,
        metadata: JSON.stringify(metadata),
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    
    // 更新会话的updated_at
    await supabase
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
    
    return message
  } catch (error) {
    logger.error('添加消息失败:', error)
    throw error
  }
}

/**
 * 获取会话的消息列表
 */
export async function getMessages(conversationId, options = {}) {
  try {
    const { page = 1, pageSize = 50 } = options
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    
    const { data: messages, count, error } = await supabase
      .from('ai_messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(from, to)
    
    if (error) throw error
    
    return {
      list: messages || [],
      total: count || 0,
      page,
      pageSize
    }
  } catch (error) {
    logger.error('获取消息列表失败:', error)
    throw error
  }
}

/**
 * 获取会话上下文
 */
export async function getConversationContext(conversationId) {
  try {
    const { data: messages, error } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    
    return (messages || []).map(m => ({
      role: m.role,
      content: m.content
    }))
  } catch (error) {
    logger.error('获取会话上下文失败:', error)
    throw error
  }
}

  createConversation,
  getConversations,
  getConversation,
  deleteConversation,
  addMessage,
  getMessages,
  getConversationContext

/**
 * 获取会话历史（别名）
 */
export async function getConversationHistory(conversationId) {
  return getConversationContext(conversationId)
}

  createConversation,
  getConversations,
  getConversation,
  deleteConversation,
  addMessage,
  getMessages,
  getConversationContext,
  getConversationHistory
