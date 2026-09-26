package com.example.readinglog.book;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface BookStatsMapper {

  @Select("SELECT COUNT(*) FROM books WHERE user_id = #{userId} AND ${condition}")
  long count(@Param("userId") long userId, @Param("condition") String condition);
}
