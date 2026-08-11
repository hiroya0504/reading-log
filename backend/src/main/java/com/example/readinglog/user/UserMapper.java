package com.example.readinglog.user;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserMapper {

  @Select("SELECT id, username, password_hash, created_at FROM users WHERE username = #{username}")
  User findByUsername(String username);
}
